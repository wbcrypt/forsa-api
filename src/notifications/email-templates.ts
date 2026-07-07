/**
 * FORSA Email Templates
 * All transactional emails with professional FORSA branding
 * Used by the NotificationsService
 */

// Was hardcoded to https:// in every link below with no env override at
// all — broke on any non-TLS deployment (reproduced locally: every
// "Suivre mon dossier"/"Voir mon historique" link in these emails was
// dead). Matches the same STUDENT_PORTAL_URL used in membership.service.ts.
const STUDENT_PORTAL_URL = process.env.STUDENT_PORTAL_URL || 'https://student.forsa.tn';

export const FORSA_EMAIL_STYLES = `
  body { margin: 0; padding: 0; background: #EEF2FC; font-family: 'Segoe UI', Arial, sans-serif; }
  .wrapper { max-width: 600px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15,28,66,0.08); }
  .header { background: linear-gradient(135deg, #122868 0%, #1B3A8C 100%); padding: 32px 40px; text-align: center; }
  .logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.02em; }
  .logo span { color: #33D6D9; }
  .tagline { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px; }
  .body { padding: 40px; }
  .greeting { font-size: 22px; font-weight: 700; color: #122868; margin-bottom: 12px; }
  .text { font-size: 15px; color: #4b5563; line-height: 1.7; margin-bottom: 16px; }
  .highlight-box { background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
  .highlight-box.success { background: #f0fdf4; border-color: #86efac; }
  .highlight-box.warning { background: #fffbeb; border-color: #fde68a; }
  .highlight-box.navy { background: #EEF2FC; border-color: #B0C4EF; }
  .highlight-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
  .highlight-value { font-size: 18px; font-weight: 700; color: #122868; }
  .btn { display: inline-block; background: #00C4C8; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0; }
  .btn:hover { background: #00A8AC; }
  .btn.navy { background: #122868; }
  .divider { border: none; border-top: 1px solid #f3f4f6; margin: 32px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
  .info-item { background: #f9fafb; border-radius: 10px; padding: 14px 16px; }
  .info-item-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
  .info-item-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #374151; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .checklist li:last-child { border-bottom: none; }
  .check { color: #00C4C8; font-weight: 700; flex-shrink: 0; }
  .footer { background: #122868; padding: 24px 40px; text-align: center; }
  .footer-text { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; }
  .footer-text a { color: rgba(255,255,255,0.5); text-decoration: none; }
  .disclaimer { font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
`

const emailWrapper = (content: string, footer?: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FORSA</title>
  <style>${FORSA_EMAIL_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">FORSA<span>.</span></div>
      <div class="tagline">Écosystème éducatif digital — 0% d'intérêts — منظومة تعليمية رقمية</div>
    </div>
    <div class="body">
      ${content}
      <p class="disclaimer">
        Cet email vous a été envoyé par FORSA Tunisia en relation avec votre demande d'adhésion.
        Si vous avez des questions, contactez-nous à <a href="mailto:hello@forsa.tn">hello@forsa.tn</a>.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">
        FORSA Tunisia · Tunis, Tunisie<br/>
        <a href="https://forsa.tn">forsa.tn</a> · <a href="mailto:hello@forsa.tn">hello@forsa.tn</a><br/>
        © 2026 FORSA. Tous droits réservés.
      </p>
    </div>
  </div>
</body>
</html>
`

// ─── 1. Application Received ───────────────────────────────────────────────────
export const applicationReceivedEmail = (data: {
  firstName: string
  lastName: string
  university: string
  program: string
  tuition: string
  applicationRef: string
}) => ({
  subject: `✅ Dossier reçu — ${data.firstName}, votre demande FORSA est en cours`,
  html: emailWrapper(`
    <p class="greeting">Bonjour ${data.firstName},</p>
    <p class="text">
      Nous avons bien reçu votre demande d'adhésion FORSA. Votre dossier est maintenant en cours de traitement.
    </p>

    <div class="highlight-box navy">
      <div class="highlight-label">Référence de votre dossier</div>
      <div class="highlight-value">${data.applicationRef}</div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-item-label">Université</div>
        <div class="info-item-value">${data.university}</div>
      </div>
      <div class="info-item">
        <div class="info-item-label">Programme</div>
        <div class="info-item-value">${data.program}</div>
      </div>
      <div class="info-item">
        <div class="info-item-label">Montant demandé</div>
        <div class="info-item-value">${data.tuition} TND</div>
      </div>
      <div class="info-item">
        <div class="info-item-label">Statut</div>
        <div class="info-item-value">🟡 En cours d'examen</div>
      </div>
    </div>

    <p class="text">
      <strong>Prochaines étapes :</strong>
    </p>
    <ul class="checklist">
      <li><span class="check">✓</span> Dossier soumis avec succès</li>
      <li><span class="check">→</span> Entretien IA de préparation (si non complété)</li>
      <li><span class="check">→</span> Examen par l'équipe FORSA (48–72 heures)</li>
      <li><span class="check">→</span> Décision de pré-approbation</li>
    </ul>

    <a href="${STUDENT_PORTAL_URL}" class="btn">Suivre mon dossier</a>

    <p class="text">
      En cas de question, écrivez-nous à <a href="mailto:students@forsa.tn">students@forsa.tn</a> en mentionnant votre référence dossier.
    </p>
  `)
})

// ─── 2. AI Interview Completed ─────────────────────────────────────────────────
export const aiInterviewCompletedEmail = (data: {
  firstName: string
  score?: number
  recommendation?: string
}) => ({
  subject: `🧠 Entretien complété — ${data.firstName}, l'équipe FORSA prend le relais`,
  html: emailWrapper(`
    <p class="greeting">Félicitations, ${data.firstName} !</p>
    <p class="text">
      Vous avez complété avec succès votre entretien de préparation FORSA. Votre dossier est maintenant entre les mains de notre équipe pour examen approfondi.
    </p>

    <div class="highlight-box success">
      <div class="highlight-label">Entretien</div>
      <div class="highlight-value">✅ Complété avec succès</div>
    </div>

    <p class="text">
      <strong>Ce que vous devez savoir :</strong>
    </p>
    <ul class="checklist">
      <li><span class="check">ℹ️</span> L'entretien est un outil d'aide à l'évaluation, pas une décision</li>
      <li><span class="check">ℹ️</span> La décision finale est prise exclusivement par l'équipe humaine FORSA</li>
      <li><span class="check">ℹ️</span> Une pré-approbation n'est pas une approbation finale</li>
      <li><span class="check">→</span> Délai de réponse : 48–72 heures ouvrées</li>
    </ul>

    <a href="${STUDENT_PORTAL_URL}" class="btn">Voir l'état de mon dossier</a>

    <p class="text">
      Notre équipe vous contactera directement avec la décision concernant votre dossier.
      Merci pour votre confiance en FORSA.
    </p>
  `)
})

// ─── 3. Pre-Approved ──────────────────────────────────────────────────────────
export const preApprovedEmail = (data: {
  firstName: string
  lastName: string
  university: string
  program: string
  amount: string
  meetingContact: string
}) => ({
  subject: `🎉 Pré-approuvé(e) — ${data.firstName}, FORSA facilite vos études !`,
  html: emailWrapper(`
    <p class="greeting">Excellente nouvelle, ${data.firstName} ! 🎉</p>
    <p class="text">
      Votre plan de facilitation des frais universitaires FORSA a été <strong>pré-approuvé</strong> pour un montant de <strong>${data.amount} TND</strong>.
    </p>

    <div class="highlight-box success">
      <div class="highlight-label">Montant pré-approuvé</div>
      <div class="highlight-value">${data.amount} TND</div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-item-label">Université</div>
        <div class="info-item-value">${data.university}</div>
      </div>
      <div class="info-item">
        <div class="info-item-label">Programme</div>
        <div class="info-item-value">${data.program}</div>
      </div>
    </div>

    <hr class="divider" />

    <p class="text"><strong>⚠️ Important — Réunion d'Activation obligatoire</strong></p>
    <p class="text">
      Pour finaliser votre plan de facilitation, vous devez participer à une <strong>Réunion d'Activation</strong> en personne avec l'équipe FORSA.
      <strong>Votre garant doit être présent à la même réunion.</strong>
    </p>

    <p class="text"><strong>Documents à apporter :</strong></p>
    <ul class="checklist">
      <li><span class="check">📋</span> Carte d'identité nationale originale (CIN)</li>
      <li><span class="check">📋</span> CIN originale du garant</li>
      <li><span class="check">📋</span> Certificat d'inscription ou d'admission</li>
      <li><span class="check">📋</span> Facture officielle de scolarité</li>
      <li><span class="check">📋</span> Justificatifs de revenus du garant</li>
    </ul>

    <p class="text">
      Pour prendre rendez-vous : <a href="mailto:${data.meetingContact}">${data.meetingContact}</a>
      ou appelez le <strong>+216 XX XXX XXX</strong>
    </p>

    <a href="${STUDENT_PORTAL_URL}/documents" class="btn">Voir la liste complète</a>

    <div class="highlight-box warning">
      <div class="highlight-label">⚠️ Rappel important</div>
      <div class="highlight-value" style="font-size:14px;font-weight:500;">La pré-approbation n'est pas une approbation finale. Elle est conditionnée à la vérification des documents lors de la Réunion d'Activation.</div>
    </div>
  `)
})

// ─── 4. Activation Meeting Invitation ─────────────────────────────────────────
export const activationMeetingEmail = (data: {
  firstName: string
  meetingDate?: string
  meetingTime?: string
  meetingAddress: string
  contactEmail: string
  contactPhone: string
}) => ({
  subject: `📅 Réunion d'Activation FORSA — ${data.firstName}, votre rendez-vous est confirmé`,
  html: emailWrapper(`
    <p class="greeting">Bonjour ${data.firstName},</p>
    <p class="text">
      Votre Réunion d'Activation FORSA ${data.meetingDate ? `est confirmée pour le <strong>${data.meetingDate} à ${data.meetingTime}</strong>` : 'a été planifiée'}.
      C'est la dernière étape avant l'activation de votre plan de facilitation.
    </p>

    ${data.meetingDate ? `
    <div class="highlight-box navy">
      <div class="info-grid" style="margin:0;">
        <div>
          <div class="highlight-label">Date</div>
          <div class="highlight-value">${data.meetingDate}</div>
        </div>
        <div>
          <div class="highlight-label">Heure</div>
          <div class="highlight-value">${data.meetingTime}</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <div class="highlight-label">Lieu</div>
        <div style="font-size:14px;color:#374151;margin-top:4px;">${data.meetingAddress}</div>
      </div>
    </div>
    ` : ''}

    <p class="text"><strong>🚨 Documents OBLIGATOIRES — Sans exception :</strong></p>
    <ul class="checklist">
      <li><span class="check">🪪</span> <strong>Votre</strong> carte d'identité nationale originale (CIN)</li>
      <li><span class="check">🪪</span> <strong>CIN originale du garant</strong> — Le garant doit être présent</li>
      <li><span class="check">🎓</span> Certificat d'inscription / admission universitaire</li>
      <li><span class="check">💳</span> Facture officielle de scolarité</li>
      <li><span class="check">🏦</span> RIB / coordonnées bancaires du garant</li>
      <li><span class="check">💼</span> Justificatifs de revenus (3 dernières fiches de paie ou attestation)</li>
    </ul>

    <p class="text"><strong>Lors de la réunion :</strong></p>
    <ul class="checklist">
      <li><span class="check">✓</span> Vérification des identités (étudiant et garant)</li>
      <li><span class="check">✓</span> Signature du contrat du plan de facilitation FORSA</li>
      <li><span class="check">✓</span> Signature des lettres de change</li>
      <li><span class="check">✓</span> Remise des copies de tous les documents</li>
      <li><span class="check">✓</span> Activation de votre compte FORSA</li>
    </ul>

    <p class="text">
      Pour toute question : <a href="mailto:${data.contactEmail}">${data.contactEmail}</a> | ${data.contactPhone}
    </p>

    <div class="highlight-box warning">
      <div class="highlight-label">Important</div>
      <div style="font-size:13px;color:#92400e;margin-top:4px;">
        La réunion ne peut avoir lieu sans la présence du garant et les documents originaux.
        Durée estimée : 45–60 minutes.
      </div>
    </div>
  `)
})

// ─── 5. Payment Reminder ──────────────────────────────────────────────────────
export const paymentReminderEmail = (data: {
  firstName: string
  installmentNumber: number
  totalInstallments: number
  amount: string
  dueDate: string
  paymentReference: string
  bankName: string
  rib: string
  iban: string
}) => ({
  subject: `💳 Rappel paiement — Versement n°${data.installmentNumber} de ${data.amount} TND dû le ${data.dueDate}`,
  html: emailWrapper(`
    <p class="greeting">Bonjour ${data.firstName},</p>
    <p class="text">
      Ceci est un rappel amical pour votre prochain versement FORSA.
    </p>

    <div class="highlight-box warning">
      <div class="info-grid" style="margin:0;">
        <div>
          <div class="highlight-label">Montant dû</div>
          <div class="highlight-value">${data.amount} TND</div>
        </div>
        <div>
          <div class="highlight-label">Date limite</div>
          <div class="highlight-value">${data.dueDate}</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <div class="highlight-label">Référence de paiement — À inclure obligatoirement</div>
        <div style="font-size:16px;font-weight:800;color:#122868;font-family:monospace;margin-top:4px;">${data.paymentReference}</div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#92400e;">
        Versement ${data.installmentNumber}/${data.totalInstallments}
      </div>
    </div>

    <p class="text"><strong>Comment payer :</strong></p>

    <div class="highlight-box">
      <div class="highlight-label">🏦 Virement bancaire</div>
      <div style="margin-top:8px;font-size:13px;color:#374151;line-height:1.8;">
        <strong>Banque :</strong> ${data.bankName}<br/>
        <strong>RIB :</strong> ${data.rib}<br/>
        <strong>IBAN :</strong> ${data.iban}<br/>
        <strong>Bénéficiaire :</strong> FORSA Tunisia<br/>
        <strong>Motif :</strong> ${data.paymentReference} ← <em>Obligatoire</em>
      </div>
    </div>

    <div class="highlight-box">
      <div class="highlight-label">💵 Dépôt en espèces</div>
      <div style="margin-top:8px;font-size:13px;color:#374151;">
        Déposez en agence ${data.bankName} sur le compte FORSA Tunisia (RIB: ${data.rib}).<br/>
        Mentionnez votre référence : <strong>${data.paymentReference}</strong>
      </div>
    </div>

    <a href="${STUDENT_PORTAL_URL}/payments" class="btn">Soumettre mon reçu</a>

    <p class="text">
      Après paiement, n'oubliez pas de <strong>télécharger votre reçu</strong> sur le portail étudiant FORSA pour confirmation.
    </p>

    <p class="text">
      En cas de difficulté, contactez-nous immédiatement à <a href="mailto:payments@forsa.tn">payments@forsa.tn</a>
      avant la date d'échéance pour éviter des pénalités.
    </p>
  `)
})

// ─── 6. Payment Received / Confirmed ──────────────────────────────────────────
export const paymentReceivedEmail = (data: {
  firstName: string
  installmentNumber: number
  totalInstallments: number
  amount: string
  paidDate: string
  paymentReference: string
  remainingAmount: string
  remainingInstallments: number
}) => ({
  subject: `✅ Paiement confirmé — ${data.amount} TND reçu, versement ${data.installmentNumber}/${data.totalInstallments}`,
  html: emailWrapper(`
    <p class="greeting">Merci, ${data.firstName} ! ✅</p>
    <p class="text">
      Votre paiement a été reçu et vérifié par l'équipe FORSA.
    </p>

    <div class="highlight-box success">
      <div class="info-grid" style="margin:0;">
        <div>
          <div class="highlight-label">Montant confirmé</div>
          <div class="highlight-value">${data.amount} TND</div>
        </div>
        <div>
          <div class="highlight-label">Date de paiement</div>
          <div class="highlight-value">${data.paidDate}</div>
        </div>
        <div>
          <div class="highlight-label">Référence</div>
          <div class="highlight-value" style="font-size:13px;font-family:monospace;">${data.paymentReference}</div>
        </div>
        <div>
          <div class="highlight-label">Versement</div>
          <div class="highlight-value">${data.installmentNumber} / ${data.totalInstallments}</div>
        </div>
      </div>
    </div>

    ${data.remainingInstallments > 0 ? `
    <div class="highlight-box navy">
      <div class="info-grid" style="margin:0;">
        <div>
          <div class="highlight-label">Montant restant</div>
          <div class="highlight-value">${data.remainingAmount} TND</div>
        </div>
        <div>
          <div class="highlight-label">Versements restants</div>
          <div class="highlight-value">${data.remainingInstallments}</div>
        </div>
      </div>
    </div>
    ` : `
    <div class="highlight-box success">
      <div class="highlight-value">🎉 Félicitations ! Vous avez complété tous vos versements FORSA.</div>
    </div>
    `}

    <a href="${STUDENT_PORTAL_URL}/payments" class="btn">Voir mon historique</a>

    <p class="text">
      Conservez cet email comme confirmation de paiement.
      Pour toute question, contactez <a href="mailto:payments@forsa.tn">payments@forsa.tn</a>.
    </p>

    <p class="text">Merci pour votre confiance et votre ponctualité. — L'équipe FORSA</p>
  `)
})


// ─── Bronze Member Email (replaces rejection) ─────────────────────────────────
export const bronzeMemberEmail = (data: {
  firstName: string
  lastName: string
  university: string
  program: string
}) => ({
  subject: `🥉 Bienvenue dans la communauté FORSA — ${data.firstName}, vous êtes Membre Bronze`,
  html: emailWrapper(`
    <p class="greeting">Bonjour ${data.firstName},</p>
    <p class="text">
      Votre dossier a été examiné avec attention par l'équipe FORSA.
      Les places disponibles pour le plan de facilitation cette session sont limitées et ont été attribuées aux candidats
      répondant à nos critères actuels d'éligibilité.
    </p>
    <p class="text">
      <strong>Vous rejoignez l'écosystème FORSA en tant que Membre Bronze.</strong>
    </p>

    <div class="highlight-box" style="background:#fffbeb;border-color:#fde68a;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:28px;">🥉</span>
        <div>
          <div class="highlight-label">Votre statut</div>
          <div class="highlight-value" style="color:#92400e;">Membre Bronze FORSA</div>
        </div>
      </div>
      <p style="font-size:13px;color:#92400e;margin:0;">
        Ce n'est pas un refus. C'est votre point d'entrée dans la communauté FORSA.
      </p>
    </div>

    <p class="text"><strong>Ce que votre adhésion Bronze inclut :</strong></p>
    <ul class="checklist">
      <li><span class="check">✓</span> Votre compte et profil FORSA — permanent</li>
      <li><span class="check">✓</span> Votre FORSA Score — visible et en progression</li>
      <li><span class="check">✓</span> Votre entretien IA enregistré dans votre dossier</li>
      <li><span class="check">✓</span> Priorité de considération au prochain cycle du plan de facilitation</li>
      <li><span class="check">✓</span> Accès aux remises et avantages des partenaires universitaires</li>
      <li><span class="check">✓</span> Ressources et accompagnement pour votre préparation financière</li>
    </ul>

    <div class="highlight-box navy">
      <div class="highlight-label">La suite</div>
      <div style="font-size:14px;color:#374151;margin-top:6px;line-height:1.7;">
        FORSA examine en priorité les membres Bronze à l'ouverture de nouvelles capacités du plan de facilitation.
        Votre historique avec nous — score, entretien, engagement — n'est jamais perdu.
        <strong>Gardez votre profil à jour.</strong>
      </div>
    </div>

    <a href="${STUDENT_PORTAL_URL}" class="btn">Accéder à mon espace FORSA</a>

    <p class="text">
      Des questions sur votre adhésion ?
      Contactez notre équipe à <a href="mailto:members@forsa.tn">members@forsa.tn</a>
    </p>

    <p class="text">Nous sommes heureux de vous compter parmi la communauté FORSA. — L'équipe FORSA</p>
  `)
})


// ─── Email dispatcher helper ───────────────────────────────────────────────────
export const EMAIL_TEMPLATES = {
  APPLICATION_RECEIVED: applicationReceivedEmail,
  AI_INTERVIEW_COMPLETED: aiInterviewCompletedEmail,
  PRE_APPROVED: preApprovedEmail,
  ACTIVATION_MEETING: activationMeetingEmail,
  PAYMENT_REMINDER: paymentReminderEmail,
  PAYMENT_RECEIVED: paymentReceivedEmail,
  BRONZE_MEMBER: bronzeMemberEmail,
}

export type EmailTemplate = keyof typeof EMAIL_TEMPLATES


// ─── Guarantor Notification Templates ─────────────────────────────────────────

export const GUARANTOR_INVITED = (guarantorName: string, studentName: string, activationLink: string) => ({
  subject: `FORSA — Invitation Portail Garant pour ${studentName}`,
  html: `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#122868;border-radius:14px;padding:28px;text-align:center;margin-bottom:24px">
        <div style="width:44px;height:44px;background:#00C4C8;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <span style="color:white;font-weight:900;font-size:20px">F</span>
        </div>
        <h1 style="color:white;font-size:22px;font-weight:800;margin:0">Invitation Portail Garant</h1>
      </div>
      <p style="color:#374151;font-size:15px">Bonjour <strong>${guarantorName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.7">
        <strong>${studentName}</strong> a soumis votre nom comme garant dans le cadre de sa candidature FORSA.
        Votre rôle de garant vous permet de suivre l'avancement de ${studentName} et d'effectuer des paiements mensuels en son nom.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${activationLink}" style="background:#00C4C8;color:white;text-decoration:none;padding:13px 28px;border-radius:12px;font-weight:700;font-size:14px;display:inline-block">
          Activer mon compte Garant →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;line-height:1.6">Ce lien est valide 7 jours. Si vous ne connaissez pas ${studentName} ou n'avez pas consenti à être garant, ignorez cet email.</p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0" />
      <p style="color:#9ca3af;font-size:11px;text-align:center">© 2026 FORSA Tunisia · <a href="https://forsa.tn" style="color:#00C4C8">forsa.tn</a></p>
    </div>
  `
})

export const GUARANTOR_PAYMENT_REMINDER = (
  guarantorName: string, studentName: string,
  amount: number, dueDate: string, paymentUrl: string
) => ({
  subject: `FORSA — Rappel paiement ${studentName} · ${amount} TND`,
  html: `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#122868;border-radius:14px;padding:24px 28px;margin-bottom:24px">
        <h1 style="color:white;font-size:20px;font-weight:800;margin:0">Rappel de paiement</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0">Garant : ${guarantorName}</p>
      </div>
      <p style="color:#374151;font-size:15px">Bonjour <strong>${guarantorName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.7">
        Une mensualité est à venir pour <strong>${studentName}</strong>.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#6b7280;font-size:13px">Étudiant</span>
          <strong style="color:#111827;font-size:13px">${studentName}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#6b7280;font-size:13px">Montant</span>
          <strong style="color:#111827;font-size:14px">${amount} TND</strong>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:#6b7280;font-size:13px">Échéance</span>
          <strong style="color:#111827;font-size:13px">${dueDate}</strong>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${paymentUrl}" style="background:#00C4C8;color:white;text-decoration:none;padding:13px 28px;border-radius:12px;font-weight:700;font-size:14px;display:inline-block">
          Effectuer le paiement →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center">© 2026 FORSA Tunisia</p>
    </div>
  `
})

export const GUARANTOR_PAYMENT_CONFIRMED = (
  guarantorName: string, studentName: string, amount: number, month: string
) => ({
  subject: `FORSA — Paiement confirmé · ${studentName} · ${month}`,
  html: `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#122868;border-radius:14px;padding:24px 28px;margin-bottom:24px">
        <h1 style="color:white;font-size:20px;font-weight:800;margin:0">✓ Paiement vérifié</h1>
      </div>
      <p style="color:#374151;font-size:15px">Bonjour <strong>${guarantorName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.7">
        Le paiement de <strong>${amount} TND</strong> pour <strong>${studentName}</strong> a été vérifié et enregistré par l'équipe FORSA.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0;text-align:center">
        <p style="color:#15803d;font-weight:700;font-size:15px;margin:0">✓ Mensualité ${month} — Payée</p>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center">© 2026 FORSA Tunisia</p>
    </div>
  `
})
