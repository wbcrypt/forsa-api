"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let AiService = AiService_1 = class AiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiService_1.name);
        this.model = 'claude-opus-4-8';
        this.apiKey = this.config.get('ai.anthropicApiKey');
    }
    get hasApiKey() {
        return !!this.apiKey && this.apiKey.startsWith('sk-ant');
    }
    async chat(messages, system, maxTokens = 1000) {
        if (!this.hasApiKey) {
            throw new Error('AI_KEY_NOT_CONFIGURED');
        }
        const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
            model: this.model,
            max_tokens: maxTokens,
            system,
            messages: messages.filter(m => m.role !== undefined),
        }, {
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const text = response.data?.content?.[0]?.text || '';
        return { content: text, demo: false };
    }
    async score(prompt) {
        if (!this.hasApiKey) {
            throw new Error('AI_KEY_NOT_CONFIGURED');
        }
        const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
            model: this.model,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        }, {
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const text = response.data?.content?.[0]?.text || '';
        return { content: text, demo: false };
    }
    async demoChat(messages, studentData) {
        const turnCount = messages.filter(m => m.role === 'user').length;
        const lastName = studentData?.lastName || '';
        const firstName = studentData?.firstName || '';
        const lang = studentData?.preferredLanguage || 'fr';
        const university = studentData?.universityName || 'votre université';
        const program = studentData?.program || 'votre programme';
        const paymentBy = studentData?.paymentResponsible || 'parent';
        const hasGuarantor = studentData?.hasGuarantor === 'yes';
        const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.toLowerCase() || '';
        if (turnCount === 0) {
            return {
                content: DEMO_SCRIPTS[lang].opening(firstName, university, program),
                demo: true,
            };
        }
        if (turnCount === 1) {
            return { content: DEMO_SCRIPTS[lang].educational1(program), demo: true };
        }
        if (turnCount === 2) {
            return { content: DEMO_SCRIPTS[lang].educational2(), demo: true };
        }
        if (turnCount === 3) {
            return { content: DEMO_SCRIPTS[lang].financial1(paymentBy), demo: true };
        }
        if (turnCount === 4) {
            return { content: DEMO_SCRIPTS[lang].financial2(paymentBy, hasGuarantor), demo: true };
        }
        if (turnCount === 5) {
            return { content: DEMO_SCRIPTS[lang].planning1(), demo: true };
        }
        if (turnCount === 6) {
            return { content: DEMO_SCRIPTS[lang].planning2(), demo: true };
        }
        if (turnCount === 7) {
            return { content: DEMO_SCRIPTS[lang].commitment1(), demo: true };
        }
        if (turnCount >= 8) {
            return { content: DEMO_SCRIPTS[lang].closing(firstName), demo: true };
        }
        return { content: DEMO_SCRIPTS[lang].followUp(), demo: true };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
const DEMO_SCRIPTS = {
    fr: {
        opening: (firstName, university, program) => `Bonjour ${firstName} ! Je suis vraiment heureux de vous rencontrer aujourd'hui.\n\nJe sais que faire une demande de financement peut sembler intimidant, mais je suis là pour apprendre à vous connaître — pas pour vous juger. Notre conversation restera confidentielle et sera transmise à l'équipe FORSA pour compléter l'évaluation de votre dossier.\n\nVous souhaitez étudier ${program} à ${university} — c'est un beau projet. Pour commencer, j'aimerais simplement vous entendre : **parlez-moi de vous**. Qui êtes-vous, et qu'est-ce qui vous a amené vers ce domaine ?`,
        educational1: (program) => `C'est vraiment intéressant ! Je sens une réelle motivation dans vos mots.\n\nQuand vous imaginez dans 5 ou 10 ans, après avoir terminé vos études en ${program}, **quelle carrière espérez-vous construire ?** Qu'est-ce que vous voulez accomplir concrètement ?`,
        educational2: () => `J'aime cette vision. Avoir un objectif clair est un vrai atout.\n\nUne question importante maintenant : **pourquoi avez-vous choisi cette université en particulier ?** Qu'est-ce qui vous a convaincu que c'était le bon endroit pour vous ?`,
        financial1: (paymentBy) => {
            const who = paymentBy === 'parent' ? 'vos parents' : paymentBy === 'self_student' ? 'vous-même' : paymentBy === 'scholarship' ? 'une bourse' : 'votre famille';
            return `Merci pour cette clarté.\n\nPassons à un sujet pratique. Vous avez indiqué que les mensualités seront couvertes par ${who}. **Pouvez-vous m'en dire plus sur cette situation ?** Est-ce que ${who === 'vous-même' ? 'votre revenu est stable et régulier' : `${who} ont déjà confirmé cet engagement`} ?`;
        },
        financial2: (paymentBy, hasGuarantor) => `Je comprends. ${hasGuarantor ? "C'est rassurant d'avoir un garant." : 'Avez-vous réfléchi à la possibilité d\'ajouter un garant pour renforcer votre dossier ?'}\n\nUne question complémentaire : **si une mensualité devenait difficile à honorer un mois donné**, avez-vous une solution de secours ? Une épargne, un proche qui pourrait aider temporairement ?`,
        planning1: () => `C'est une très bonne façon de voir les choses.\n\nImaginez maintenant un scénario hypothétique : **la personne qui devait payer les mensualités rencontre une difficulté imprévue pendant 2 mois**. Qu'est-ce que vous feriez concrètement ? Avez-vous déjà discuté de ce genre de situation avec votre famille ?`,
        planning2: () => `Votre capacité à anticiper les difficultés est vraiment positive.\n\nDernière question sur ce sujet : **avez-vous un plan B concret ?** Par exemple : un emploi à temps partiel possible, une aide familiale, une épargne de secours ?`,
        commitment1: () => `Excellent. Je commence à avoir une bonne image de votre profil.\n\nUne dernière chose que j'aimerais comprendre : **parlez-moi d'un engagement que vous avez tenu avec succès dans le passé** — que ce soit dans vos études, un projet personnel, ou une responsabilité familiale. Comment avez-vous maintenu cet engagement dans le temps ?`,
        closing: (firstName) => `${firstName}, je vous remercie sincèrement pour cette conversation. Vous avez été ouvert, réfléchi et clair dans vos réponses.\n\nCe qui m'a particulièrement impressionné :\n• Votre clarté sur vos objectifs professionnels\n• Votre conscience des responsabilités financières\n• Votre capacité à anticiper les difficultés\n\nL'équipe FORSA va maintenant examiner l'ensemble de votre dossier, y compris cette conversation, et vous contactera dans les **48 heures** avec une réponse.\n\n⚠️ **Important :** Cette conversation est une aide à l'évaluation. La décision finale appartient exclusivement à l'équipe humaine de FORSA. Une pré-approbation n'est pas une approbation définitive.\n\nBonne chance, ${firstName} — vous avez bien présenté votre projet ! 🌟`,
        followUp: () => `C'est très intéressant. Pouvez-vous me donner un exemple concret de ce que vous venez de mentionner ?`,
    },
    en: {
        opening: (firstName, university, program) => `Hello ${firstName}! I'm really glad to meet you today.\n\nI know that applying for financing can feel like a big step, but I'm here to get to know you — not to judge you. Our conversation is confidential and will be shared with the FORSA team to complete your application review.\n\nYou'd like to study ${program} at ${university} — that's a great project. To start, I'd just love to hear from you: **tell me about yourself**. Who are you, and what drew you to this field?`,
        educational1: (program) => `That's really interesting! I can feel a genuine motivation in what you're sharing.\n\nWhen you picture yourself in 5 or 10 years after completing your studies in ${program}, **what career do you hope to build?** What do you want to achieve?`,
        educational2: () => `I love that vision. Having a clear goal is a real strength.\n\nAn important question now: **why did you choose this university in particular?** What convinced you it was the right place for you?`,
        financial1: (paymentBy) => {
            const who = paymentBy === 'parent' ? 'your parents' : paymentBy === 'self_student' ? 'yourself' : paymentBy === 'scholarship' ? 'a scholarship' : 'your family';
            return `Thank you for that clarity.\n\nLet's talk about something practical. You mentioned that monthly payments will be covered by ${who}. **Can you tell me more about that?** ${paymentBy === 'self_student' ? 'Is your income stable and regular?' : `Have ${who} already confirmed this commitment?`}`;
        },
        financial2: (paymentBy, hasGuarantor) => `I understand. ${hasGuarantor ? "It's reassuring to have a guarantor." : 'Have you thought about adding a guarantor to strengthen your application?'}\n\nA follow-up question: **if a monthly payment became difficult one month**, do you have a backup? Some savings, or someone who could help temporarily?`,
        planning1: () => `That's a very good way to think about it.\n\nNow imagine a hypothetical scenario: **the person who was supposed to pay the installments faces an unexpected difficulty for 2 months**. What would you do concretely? Have you discussed this kind of situation with your family?`,
        planning2: () => `Your ability to anticipate difficulties is really positive.\n\nOne last question on this topic: **do you have a concrete backup plan?** For example: a possible part-time job, family support, or emergency savings?`,
        commitment1: () => `Excellent. I'm getting a good picture of your profile.\n\nOne last thing I'd like to understand: **tell me about a commitment you successfully kept in the past** — whether in your studies, a personal project, or a family responsibility. How did you maintain that commitment over time?`,
        closing: (firstName) => `${firstName}, I sincerely thank you for this conversation. You've been open, thoughtful, and clear in your answers.\n\nWhat particularly impressed me:\n• Your clarity about your career goals\n• Your awareness of financial responsibilities\n• Your ability to anticipate difficulties\n\nThe FORSA team will now review your complete file, including this conversation, and will contact you within **48 hours** with a response.\n\n⚠️ **Important:** This conversation is an assessment tool. The final decision belongs exclusively to the FORSA human team. A pre-approval is not a final approval.\n\nGood luck, ${firstName} — you presented your project well! 🌟`,
        followUp: () => `That's very interesting. Could you give me a concrete example of what you just mentioned?`,
    },
    ar: {
        opening: (firstName, university, program) => `مرحباً ${firstName}! يسعدني جداً لقاؤك اليوم.\n\nأعلم أن التقدم بطلب تمويل قد يبدو خطوة كبيرة، لكنني هنا لأتعرف عليك — وليس لأحكم عليك. محادثتنا سرية وستُشارك مع فريق FORSA لإتمام مراجعة طلبك.\n\nتودّ دراسة ${program} في ${university} — هذا مشروع رائع. للبدء، أودّ أن أسمع منك ببساطة: **أخبرني عن نفسك**. من أنت، وما الذي جذبك إلى هذا المجال؟`,
        educational1: (program) => `هذا مثير للاهتمام حقاً! أشعر بدافعية حقيقية في كلامك.\n\nعندما تتخيل نفسك بعد 5 أو 10 سنوات من إتمام دراستك في ${program}، **ما المسار المهني الذي تأمل في بنائه؟** ماذا تريد أن تحقق؟`,
        educational2: () => `أحب هذه الرؤية. وضوح الهدف ميزة حقيقية.\n\nسؤال مهم الآن: **لماذا اخترت هذه الجامعة تحديداً؟** ما الذي أقنعك بأنها المكان المناسب لك؟`,
        financial1: (paymentBy) => {
            const who = paymentBy === 'parent' ? 'والديك' : paymentBy === 'self_student' ? 'نفسك' : paymentBy === 'scholarship' ? 'منحة دراسية' : 'عائلتك';
            return `شكراً على هذا الوضوح.\n\nلنتحدث عن موضوع عملي. ذكرت أن الأقساط الشهرية ستُغطى من قِبَل ${who}. **هل يمكنك إخباري أكثر عن هذا الوضع؟** ${paymentBy === 'self_student' ? 'هل دخلك مستقر ومنتظم؟' : `هل ${who} أكد/أكدا هذا الالتزام بالفعل؟`}`;
        },
        financial2: (paymentBy, hasGuarantor) => `أفهم ذلك. ${hasGuarantor ? 'وجود ضامن أمر مطمئن.' : 'هل فكرت في إضافة ضامن لتعزيز ملفك؟'}\n\nسؤال إضافي: **إذا أصبح أحد الأقساط الشهرية صعباً في شهر معين**، هل لديك خطة بديلة؟ مدخرات، أو شخص يمكنه المساعدة مؤقتاً؟`,
        planning1: () => `هذه طريقة تفكير جيدة جداً.\n\nتخيّل الآن سيناريو افتراضي: **الشخص الذي كان يدفع الأقساط واجه صعوبة غير متوقعة لمدة شهرين**. ماذا ستفعل تحديداً؟ هل ناقشت هذا النوع من المواقف مع عائلتك؟`,
        planning2: () => `قدرتك على استباق الصعوبات أمر إيجابي جداً.\n\nسؤال أخير حول هذا الموضوع: **هل لديك خطة بديلة محددة؟** مثلاً: عمل بدوام جزئي ممكن، أو دعم عائلي، أو مدخرات طوارئ؟`,
        commitment1: () => `ممتاز. أبدأ في الحصول على صورة واضحة عن ملفك.\n\nشيء أخير أودّ فهمه: **أخبرني عن التزام نجحت في الحفاظ عليه في الماضي** — سواء في دراستك، مشروع شخصي، أو مسؤولية عائلية. كيف حافظت على هذا الالتزام مع مرور الوقت؟`,
        closing: (firstName) => `${firstName}، أشكرك بصدق على هذه المحادثة. لقد كنت منفتحاً ومتأملاً وواضحاً في إجاباتك.\n\nما أثار إعجابي بشكل خاص:\n• وضوحك بشأن أهدافك المهنية\n• وعيك بالمسؤوليات المالية\n• قدرتك على استباق الصعوبات\n\nسيراجع فريق FORSA الآن ملفك الكامل، بما في ذلك هذه المحادثة، وسيتواصل معك خلال **48 ساعة** بالرد.\n\n⚠️ **مهم:** هذه المحادثة أداة مساعدة للتقييم. القرار النهائي يعود حصراً لفريق FORSA البشري. الموافقة المبدئية ليست موافقة نهائية.\n\nبالتوفيق، ${firstName} — قدّمت مشروعك بشكل جيد! 🌟`,
        followUp: () => `هذا مثير للاهتمام جداً. هل يمكنك إعطائي مثالاً ملموساً على ما ذكرته للتو؟`,
    },
};
//# sourceMappingURL=ai.service.js.map