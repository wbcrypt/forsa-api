-- Migration 017: Meeting email updates (Phase 14 — Final Case Flow Refinement)
--
-- "Student and guarantor both receive meeting details: date, time,
-- location, reference number, assigned FORSA officer, required attendees,
-- required paperwork, clear mention that originals are verified during
-- the meeting." Adds the assigned officer's name and an explicit
-- originals-verification line to the templates added in migration 015.

UPDATE notification_templates SET body_template =
  '<p>Dear {{recipientName}},</p>
   <p>Your Tuition Facilitation Case for <strong>{{studentName}}</strong> has been approved in principle. The last step before activation is a short in-person meeting to verify identities and original documents.</p>
   <p><strong>Date:</strong> {{meetingDate}}<br/>
      <strong>Time:</strong> {{meetingTime}}<br/>
      <strong>Location:</strong> {{officeLocation}}<br/>
      <strong>Reference number:</strong> {{referenceNumber}}<br/>
      <strong>Assigned FORSA officer:</strong> {{assignedOfficerName}}<br/>
      <strong>Estimated duration:</strong> {{estimatedDuration}} minutes<br/>
      <strong>Required attendees:</strong> {{requiredAttendees}}</p>
   <p><strong>Please bring the following original documents — they will be verified in person at the meeting:</strong> {{requiredDocuments}}</p>
   <p>{{specialInstructions}}</p>
   <p>If you cannot attend, please contact FORSA as soon as possible to reschedule.</p>'
WHERE code = 'meeting_scheduled' AND channel = 'email';

UPDATE notification_templates SET body_template =
  '<p>Dear {{recipientName}},</p>
   <p>Your Activation Meeting for {{studentName}}''s Case has been rescheduled.</p>
   <p><strong>New date:</strong> {{meetingDate}}<br/>
      <strong>New time:</strong> {{meetingTime}}<br/>
      <strong>Location:</strong> {{officeLocation}}<br/>
      <strong>Reference number:</strong> {{referenceNumber}}<br/>
      <strong>Assigned FORSA officer:</strong> {{assignedOfficerName}}</p>
   <p>Original documents will still be verified in person at the new meeting time.</p>'
WHERE code = 'meeting_rescheduled' AND channel = 'email';
