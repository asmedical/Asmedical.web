// Page d'assistance publique — français, arabe, anglais.
//
// Elle sert d'URL d'assistance pour les stores (Apple exige une adresse
// joignable sans compte) ET de point d'entrée pour les patients.
//
// Les trois langues vivent dans CE fichier, côte à côte. Réparties dans trois
// pages séparées, elles auraient dérivé au premier changement de numéro ou
// d'horaire : ici, une modification saute aux yeux si elle n'est pas reportée.
//
// L'anglais existe pour les examinateurs des stores et les visiteurs
// étrangers ; l'application, elle, reste en français et en arabe — les
// patients d'Alger n'ont pas besoin d'une troisième langue.

export const LANGUES = [
  { cle: "fr", nom: "Français", dir: "ltr" },
  { cle: "ar", nom: "العربية", dir: "rtl" },
  { cle: "en", nom: "English", dir: "ltr" },
];

export const TEL_AFFICHE = "+213 5 64 49 33 48";
export const TEL_LIEN = "tel:+213564493348";
export const WHATSAPP_LIEN = "https://wa.me/213564493348";
export const EMAIL = "contact@asm-sante.com";

export const AIDE = {
  fr: {
    titre: "Assistance ASM",
    intro:
      "ASM (Assistance Sociale Médicale) organise des transports sanitaires, de l'aide à domicile et des livraisons de médicaments dans la wilaya d'Alger. Cette page vous dit comment nous joindre et quoi faire en cas de problème.",
    urgence_t: "Urgence vitale",
    urgence_p:
      "ASM n'est pas un service d'urgence. En cas d'urgence vitale, appelez le SAMU (115) ou la Protection civile (14). Nous organisons des prises en charge programmées.",
    contact_t: "Nous joindre",
    contact_p: "Notre équipe répond 7 jours sur 7.",
    tel_l: "Téléphone",
    whatsapp_l: "WhatsApp",
    email_l: "E-mail",
    delai: "Par téléphone, la réponse est immédiate. Par e-mail, comptez une journée ouvrée.",
    sujets_t: "Questions fréquentes",
    sujets: [
      {
        q: "Je n'arrive pas à me connecter",
        r: "Mot de passe oublié, code SMS non reçu, identifiant perdu : la page d'aide à la connexion traite ces trois cas.",
        lien: "/aide-connexion",
        lien_l: "Ouvrir l'aide à la connexion",
      },
      {
        q: "Comment réserver ?",
        r: "Choisissez une prestation sur l'accueil, puis laissez-vous guider : le besoin, l'adresse, la date et l'heure, puis la confirmation. Le prix estimé s'affiche avant de valider.",
      },
      {
        q: "Comment suivre ou annuler une demande ?",
        r: "Vos demandes sont dans l'onglet « Rendez-vous ». Pour annuler ou modifier, appelez-nous : l'équipe réajuste avec vous.",
      },
      {
        q: "Comment supprimer mon compte ?",
        r: "Depuis la page dédiée, par e-mail ou par téléphone. La demande est traitée sous 30 jours.",
        lien: "/suppression-compte",
        lien_l: "Supprimer mon compte",
      },
      {
        q: "Que faites-vous de mes données de santé ?",
        r: "Elles ne servent qu'à organiser votre prise en charge et ne sont jamais vendues. Le détail est dans notre politique de confidentialité.",
        lien: "/confidentialite",
        lien_l: "Politique de confidentialité",
      },
    ],
  },

  ar: {
    titre: "مساعدة ASM",
    intro:
      "تنظّم ASM (المساعدة الاجتماعية الطبية) النقل الصحي والمساعدة المنزلية وتوصيل الأدوية في ولاية الجزائر. تشرح هذه الصفحة كيفية الاتصال بنا وما العمل عند مواجهة مشكلة.",
    urgence_t: "حالة طارئة تهدد الحياة",
    urgence_p:
      "ASM ليست خدمة إسعاف. في حالة الطوارئ المهدِّدة للحياة، اتصلوا بالإسعاف (115) أو الحماية المدنية (14). نحن ننظّم تكفّلات مبرمَجة.",
    contact_t: "الاتصال بنا",
    contact_p: "فريقنا يجيب سبعة أيام في الأسبوع.",
    tel_l: "الهاتف",
    whatsapp_l: "واتساب",
    email_l: "البريد الإلكتروني",
    delai: "عبر الهاتف يكون الرد فورياً. عبر البريد الإلكتروني، احتسبوا يوم عمل واحداً.",
    sujets_t: "أسئلة متكررة",
    sujets: [
      {
        q: "لا أستطيع تسجيل الدخول",
        r: "كلمة سر منسية، رمز SMS لم يصل، معرّف ضائع: صفحة المساعدة على تسجيل الدخول تعالج هذه الحالات الثلاث.",
        lien: "/aide-connexion",
        lien_l: "فتح المساعدة على تسجيل الدخول",
      },
      {
        q: "كيف أحجز؟",
        r: "اختاروا خدمة من الصفحة الرئيسية، ثم دعوا التطبيق يرشدكم: الحاجة، العنوان، التاريخ والساعة، ثم التأكيد. يظهر السعر التقديري قبل التأكيد.",
      },
      {
        q: "كيف أتابع طلبي أو ألغيه؟",
        r: "طلباتكم في تبويب « المواعيد ». للإلغاء أو التعديل، اتصلوا بنا: يعيد الفريق الترتيب معكم.",
      },
      {
        q: "كيف أحذف حسابي؟",
        r: "من الصفحة المخصصة، أو عبر البريد الإلكتروني، أو بالهاتف. يُعالَج الطلب في أجل 30 يوماً.",
        lien: "/suppression-compte",
        lien_l: "حذف حسابي",
      },
      {
        q: "ماذا تفعلون ببياناتي الصحية؟",
        r: "تُستعمل فقط لتنظيم تكفّلكم ولا تُباع أبداً. التفاصيل في سياسة الخصوصية.",
        lien: "/confidentialite",
        lien_l: "سياسة الخصوصية",
      },
    ],
  },

  en: {
    titre: "ASM Support",
    intro:
      "ASM (Assistance Sociale Médicale) arranges non-emergency medical transport, home care visits and pharmacy deliveries in the wilaya of Algiers, Algeria. This page explains how to reach us and what to do if something goes wrong.",
    urgence_t: "Life-threatening emergency",
    urgence_p:
      "ASM is not an emergency service. In a life-threatening emergency, call SAMU (115) or Civil Protection (14). We arrange scheduled care only.",
    contact_t: "Contact us",
    contact_p: "Our team answers seven days a week.",
    tel_l: "Phone",
    whatsapp_l: "WhatsApp",
    email_l: "Email",
    delai: "By phone the answer is immediate. By email, allow one working day.",
    sujets_t: "Frequently asked questions",
    sujets: [
      {
        q: "I can't sign in",
        r: "Forgotten password, SMS code not received, lost username: the sign-in help page covers all three.",
        lien: "/aide-connexion",
        lien_l: "Open sign-in help",
      },
      {
        q: "How do I book?",
        r: "Pick a service on the home screen, then follow the steps: what you need, the address, the date and time, then confirmation. The estimated price is shown before you confirm.",
      },
      {
        q: "How do I track or cancel a request?",
        r: "Your requests are in the « Appointments » tab. To cancel or change one, call us and the team will rearrange it with you.",
      },
      {
        q: "How do I delete my account?",
        r: "From the dedicated page, by email, or by phone. Requests are handled within 30 days.",
        lien: "/suppression-compte",
        lien_l: "Delete my account",
      },
      {
        q: "What do you do with my health data?",
        r: "It is used only to arrange your care and is never sold. The details are in our privacy policy.",
        lien: "/confidentialite",
        lien_l: "Privacy policy",
      },
    ],
  },
};
