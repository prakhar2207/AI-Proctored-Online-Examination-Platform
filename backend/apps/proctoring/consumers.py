import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from apps.exams.models import ExamSession
from .models import ProctorEvent, SuspicionScore

class ProctoringConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_token = self.scope['url_route']['kwargs']['session_token']
        self.session = await self.get_session(self.session_token)

        if self.session is None or self.session.status != ExamSession.Status.IN_PROGRESS:
            await self.close(code=4003)  # Custom close code: Invalid/completed session
            return

        self.group_name = f"proctoring_{self.session.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event_type = data.get('type')
        if event_type == 'heartbeat':
            violations = data.get('violations', [])
            score, warnings = await self.process_heartbeat(self.session.id, violations)

            # Send acknowledgement back to client with current statistics
            await self.send(text_data=json.dumps({
                'type': 'heartbeat_ack',
                'status': 'alive',
                'suspicion_score': score,
                'warnings_count': warnings
            }))

    @database_sync_to_async
    def get_session(self, token):
        try:
            return ExamSession.objects.select_related('exam', 'student').get(session_token=token)
        except (ExamSession.DoesNotExist, ValueError):
            return None

    @database_sync_to_async
    def process_heartbeat(self, session_id, violations):
        session = ExamSession.objects.get(id=session_id)
        
        # Get or create aggregated suspicion summary
        summary, _ = SuspicionScore.objects.get_or_create(session=session)
        
        # If no violations are sent, log a normal heartbeat event
        if not violations:
            ProctorEvent.objects.create(
                session=session,
                event_type=ProctorEvent.EventType.HEARTBEAT,
                suspicion_increment=0
            )
        else:
            # Map client violation strings to database Enum values
            for violation in violations:
                db_event_type = self._map_violation_type(violation)
                inc = self._get_violation_increment(db_event_type)
                
                # Log individual event
                ProctorEvent.objects.create(
                    session=session,
                    event_type=db_event_type,
                    suspicion_increment=inc,
                    details=violation.get('details', {}) if isinstance(violation, dict) else {}
                )
                
                # Update aggregated summary
                summary.add_violation(db_event_type, inc)

        # Enforce Auto-Flagging if warnings limit is reached
        max_allowed = session.exam.max_tab_switches
        if summary.warnings_count >= max_allowed:
            session.status = ExamSession.Status.FLAGGED
            session.save()

        return summary.score, summary.warnings_count

    def _map_violation_type(self, violation):
        v_type = violation.get('type') if isinstance(violation, dict) else violation
        mapping = {
            'face_absent': ProctorEvent.EventType.FACE_ABSENT,
            'multiple_faces': ProctorEvent.EventType.MULTIPLE_FACES,
            'gaze_away': ProctorEvent.EventType.GAZE_AWAY,
            'tab_switch': ProctorEvent.EventType.TAB_SWITCH,
            'window_blur': ProctorEvent.EventType.WINDOW_BLUR,
            'fullscreen_exit': ProctorEvent.EventType.FULLSCREEN_EXIT,
        }
        return mapping.get(v_type, ProctorEvent.EventType.HEARTBEAT)

    def _get_violation_increment(self, db_event_type):
        increments = {
            ProctorEvent.EventType.FACE_ABSENT: 15,
            ProctorEvent.EventType.MULTIPLE_FACES: 25,
            ProctorEvent.EventType.GAZE_AWAY: 5,
            ProctorEvent.EventType.TAB_SWITCH: 20,
            ProctorEvent.EventType.WINDOW_BLUR: 10,
            ProctorEvent.EventType.FULLSCREEN_EXIT: 30,
        }
        return increments.get(db_event_type, 0)
