-- Migration 015: Meeting notification template (Phase 13 — Case Management)
--
-- "Both student and guarantor receive: Date, Time, Office location,
-- Reference number, Assigned FORSA officer, Estimated duration, Required
-- original documents, Required attendees, Special instructions." The
-- product's email templates file (email-templates.ts) already had an
-- unused activationMeetingEmail() function anticipating this — this adds
-- the DB-side template row applications.service.ts#scheduleMeeting sends
-- through, following the same {{variable}} substitution style as every
-- other seeded template (see application_approved for reference).

INSERT INTO notification_templates (code, channel, name, subject_template, body_template, is_active)
VALUES (
  'meeting_scheduled',
  'email',
  'Case Activation Meeting Scheduled',
  '📅 Your FORSA Activation Meeting — {{referenceNumber}}',
  '<p>Dear {{recipientName}},</p>
   <p>Your Tuition Facilitation Case for <strong>{{studentName}}</strong> has been approved in principle. The last step before activation is a short in-person meeting to verify identities and original documents.</p>
   <p><strong>Date:</strong> {{meetingDate}}<br/>
      <strong>Time:</strong> {{meetingTime}}<br/>
      <strong>Location:</strong> {{officeLocation}}<br/>
      <strong>Reference number:</strong> {{referenceNumber}}<br/>
      <strong>Estimated duration:</strong> {{estimatedDuration}} minutes<br/>
      <strong>Required attendees:</strong> {{requiredAttendees}}</p>
   <p><strong>Please bring the original documents:</strong> {{requiredDocuments}}</p>
   <p>{{specialInstructions}}</p>
   <p>If you cannot attend, please contact FORSA as soon as possible to reschedule.</p>',
  true
)
ON CONFLICT (code, channel) DO NOTHING;

INSERT INTO notification_templates (code, channel, name, subject_template, body_template, is_active)
VALUES (
  'meeting_rescheduled',
  'email',
  'Case Activation Meeting Rescheduled',
  '📅 Your FORSA Activation Meeting Has Been Rescheduled — {{referenceNumber}}',
  '<p>Dear {{recipientName}},</p>
   <p>Your Activation Meeting for {{studentName}}''s Case has been rescheduled.</p>
   <p><strong>New date:</strong> {{meetingDate}}<br/>
      <strong>New time:</strong> {{meetingTime}}<br/>
      <strong>Location:</strong> {{officeLocation}}<br/>
      <strong>Reference number:</strong> {{referenceNumber}}</p>',
  true
)
ON CONFLICT (code, channel) DO NOTHING;

INSERT INTO notification_templates (code, channel, name, subject_template, body_template, is_active)
VALUES (
  'meeting_cancelled',
  'email',
  'Case Activation Meeting Cancelled',
  'Your FORSA Activation Meeting Has Been Cancelled — {{referenceNumber}}',
  '<p>Dear {{recipientName}},</p>
   <p>Your Activation Meeting for {{studentName}}''s Case ({{referenceNumber}}) has been cancelled. {{cancellationReason}}</p>
   <p>FORSA will contact you to schedule a new meeting.</p>',
  true
)
ON CONFLICT (code, channel) DO NOTHING;
