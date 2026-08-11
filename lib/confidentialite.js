// Politique de confidentialité — SOURCE UNIQUE, partagée par le site et
// l'application, en français, arabe et anglais.
//
// Ce document engage juridiquement ASM. Le recopier dans l'application
// aurait produit deux versions destinées à diverger : au premier
// amendement, l'une des deux serait devenue fausse. Le texte vit donc ici,
// le site le rend directement, et l'application le récupère par
// /api/confidentialite.
//
// LE FRANÇAIS FAIT FOI. Les versions arabe et anglaise sont des traductions
// de commodité : elles servent aux patients arabophones et aux examinateurs
// des stores, mais en cas de divergence c'est le texte français qui
// s'applique. Les pages traduites le disent, plutôt que de laisser croire à
// trois documents juridiques équivalents.

export const MAJ = "12 juillet 2026";
export const MAJ_AR = "12 جويلية 2026";
export const MAJ_EN = "12 July 2026";

export const LANGUES = [
  { cle: "fr", nom: "Français", dir: "ltr" },
  { cle: "ar", nom: "العربية", dir: "rtl" },
  { cle: "en", nom: "English", dir: "ltr" },
];

// Chaque section : un titre, des paragraphes, une liste facultative.
// Les points de liste sont { fort, texte } — « fort » est le début en gras.
const FR = [
  {
    titre: "1. Qui sommes-nous ?",
    paragraphes: [
      "ASM (Assistance Sociale Médicale) exploite le site et l'application asm-sante.com, qui permettent de réserver un transport sanitaire, une aide à domicile ou une livraison de médicaments dans la wilaya d'Alger, et d'en suivre l'exécution. Contact : contact@asm-sante.com.",
    ],
  },
  {
    titre: "2. Données que nous collectons",
    points: [
      { fort: "Identité et contact", texte: "nom, prénom, numéro de téléphone, e-mail (facultatif), commune, contact d'un proche (facultatif)." },
      { fort: "Données de réservation", texte: "prestations demandées, adresses de départ et de destination, dates, créneaux, consignes que vous renseignez." },
      { fort: "Documents", texte: "que vous déposez volontairement (par exemple une ordonnance pour une livraison de médicaments)." },
      { fort: "Données de compte", texte: "identifiants de connexion (le mot de passe est stocké sous forme chiffrée, jamais en clair), préférences de langue et de notifications." },
      { fort: "Données techniques minimales", texte: "nécessaires au fonctionnement et à la sécurité (journaux serveur, protection anti-abus). Nous n'utilisons pas de cookies publicitaires." },
    ],
  },
  {
    titre: "3. Pourquoi nous les utilisons",
    points: [
      { texte: "Organiser et exécuter vos prestations (réservation, affectation d'un intervenant, suivi, facturation)." },
      { texte: "Vous tenir informé : notifications de suivi, messages de l'équipe, rappels de rendez-vous." },
      { texte: "Sécuriser les comptes (codes de connexion, journal des actions sensibles)." },
      { texte: "Améliorer le service (statistiques d'activité internes, jamais revendues)." },
    ],
    paragraphes: ["Nous ne vendons ni ne louons vos données à personne."],
  },
  {
    titre: "4. Qui peut voir vos données",
    points: [
      { fort: "L'équipe ASM", texte: "selon des rôles stricts contrôlés par nos serveurs : chaque membre ne voit que ce qui est nécessaire à sa mission, et les actions sensibles sont journalisées." },
      { fort: "L'intervenant affecté", texte: "à votre demande (chauffeur, auxiliaire de santé, coursier) : uniquement les informations utiles à la mission — jamais vos documents ni votre historique complet." },
      { fort: "Un établissement de santé", texte: "uniquement si vous l'y avez autorisé (procuration que vous pouvez révoquer à tout moment depuis votre espace)." },
      { fort: "Nos sous-traitants techniques", texte: "qui hébergent ou acheminent pour notre compte : hébergement du site et de la base de données, envoi de SMS, d'e-mails et de notifications. Ils n'utilisent pas vos données pour leur propre compte." },
    ],
  },
  {
    titre: "5. Conservation",
    paragraphes: [
      "Les données de votre compte sont conservées tant que le compte est actif. L'historique des prestations est conservé pour les besoins de gestion et les obligations comptables. En cas de suppression de compte, vos identifiants de connexion sont supprimés ; l'historique est conservé sous une forme limitée aux besoins légaux.",
    ],
  },
  {
    titre: "6. Vos droits",
    points: [
      { texte: "Consulter et corriger vos informations depuis votre espace, ou en nous contactant." },
      { texte: "Révoquer à tout moment une autorisation donnée à un établissement." },
      { texte: "Désactiver les notifications depuis votre téléphone ou votre profil." },
      { texte: "Demander la suppression de votre compte et de vos données : depuis la page dédiée asm-sante.com/suppression-compte, par email à contact@asm-sante.com ou par téléphone ; la demande est traitée sous 30 jours." },
    ],
  },
  {
    titre: "7. Sécurité",
    paragraphes: [
      "Connexions chiffrées (HTTPS), mots de passe jamais stockés en clair ni visibles (même par nos administrateurs), documents stockés dans un espace privé accessible par liens temporaires signés, droits vérifiés côté serveur à chaque action, journal d'audit des opérations sensibles.",
    ],
  },
  {
    titre: "8. Enfants",
    paragraphes: [
      "Le service s'adresse aux adultes. Un mineur est pris en charge via le compte d'un parent, d'un tuteur ou d'un établissement autorisé.",
    ],
  },
  {
    titre: "9. Évolutions de cette politique",
    paragraphes: [
      "Si cette politique évolue, la date de mise à jour ci-dessus change et les modifications importantes sont annoncées dans l'application.",
    ],
  },
];

const AR = [
  {
    titre: "1. من نحن؟",
    paragraphes: [
      "تدير ASM (المساعدة الاجتماعية الطبية) الموقع والتطبيق asm-sante.com، اللذين يتيحان حجز نقل صحي أو مساعدة منزلية أو توصيل أدوية في ولاية الجزائر، ومتابعة تنفيذها. للاتصال: contact@asm-sante.com.",
    ],
  },
  {
    titre: "2. البيانات التي نجمعها",
    points: [
      { fort: "الهوية ووسائل الاتصال", texte: "الاسم واللقب، رقم الهاتف، البريد الإلكتروني (اختياري)، البلدية، جهة اتصال قريب (اختياري)." },
      { fort: "بيانات الحجز", texte: "الخدمات المطلوبة، عنوانا الانطلاق والوجهة، التواريخ، المواعيد، والتعليمات التي تدوّنونها." },
      { fort: "الوثائق", texte: "التي ترفعونها طوعاً (مثل وصفة طبية لتوصيل الأدوية)." },
      { fort: "بيانات الحساب", texte: "معرّفات الدخول (كلمة السر تُخزَّن مشفَّرة، ولا تُخزَّن أبداً بشكل واضح)، تفضيلات اللغة والإشعارات." },
      { fort: "بيانات تقنية في حدّها الأدنى", texte: "لازمة للتشغيل والأمن (سجلات الخادم، الحماية من إساءة الاستعمال). لا نستعمل ملفات تعريف ارتباط إشهارية." },
    ],
  },
  {
    titre: "3. لماذا نستعملها",
    points: [
      { texte: "تنظيم خدماتكم وتنفيذها (الحجز، تعيين متدخّل، المتابعة، الفوترة)." },
      { texte: "إبقاؤكم على اطّلاع: إشعارات المتابعة، رسائل الفريق، تذكير بالمواعيد." },
      { texte: "تأمين الحسابات (رموز الدخول، سجلّ العمليات الحسّاسة)." },
      { texte: "تحسين الخدمة (إحصائيات نشاط داخلية، لا تُباع أبداً)." },
    ],
    paragraphes: ["لا نبيع بياناتكم ولا نؤجّرها لأي جهة."],
  },
  {
    titre: "4. من يمكنه الاطّلاع على بياناتكم",
    points: [
      { fort: "فريق ASM", texte: "وفق أدوار صارمة تراقبها خوادمنا: كل عضو لا يرى إلا ما تقتضيه مهمّته، والعمليات الحسّاسة تُسجَّل." },
      { fort: "المتدخّل المكلَّف", texte: "بطلبكم (سائق، مساعد صحي، موزّع): المعلومات المفيدة للمهمة فقط — لا وثائقكم ولا سجلّكم الكامل." },
      { fort: "مؤسسة صحية", texte: "فقط إذا أذنتم لها بذلك (توكيل يمكنكم سحبه في أي وقت من فضائكم)." },
      { fort: "مقدّمو خدماتنا التقنيون", texte: "الذين يستضيفون أو ينقلون لحسابنا: استضافة الموقع وقاعدة البيانات، إرسال الرسائل القصيرة والبريد الإلكتروني والإشعارات. لا يستعملون بياناتكم لحسابهم الخاص." },
    ],
  },
  {
    titre: "5. مدة الحفظ",
    paragraphes: [
      "تُحفظ بيانات حسابكم ما دام الحساب نشطاً. ويُحفظ سجلّ الخدمات لأغراض التسيير والالتزامات المحاسبية. عند حذف الحساب، تُحذف معرّفات الدخول؛ ويُحفظ السجلّ في حدود ما تقتضيه القوانين.",
    ],
  },
  {
    titre: "6. حقوقكم",
    points: [
      { texte: "الاطّلاع على معلوماتكم وتصحيحها من فضائكم، أو بالاتصال بنا." },
      { texte: "سحب أي إذن مُنِح لمؤسسة، في أي وقت." },
      { texte: "تعطيل الإشعارات من هاتفكم أو من ملفكم الشخصي." },
      { texte: "طلب حذف حسابكم وبياناتكم: من الصفحة المخصصة asm-sante.com/suppression-compte، أو عبر البريد contact@asm-sante.com، أو بالهاتف؛ يُعالَج الطلب في أجل 30 يوماً." },
    ],
  },
  {
    titre: "7. الأمن",
    paragraphes: [
      "اتصالات مشفَّرة (HTTPS)، كلمات سر لا تُخزَّن أبداً بشكل واضح ولا تكون مرئية (ولا حتى لمسؤولينا)، وثائق مخزَّنة في فضاء خاص لا يُفتح إلا بروابط مؤقتة موقَّعة، حقوق يتحقق منها الخادم عند كل عملية، وسجلّ تدقيق للعمليات الحسّاسة.",
    ],
  },
  {
    titre: "8. الأطفال",
    paragraphes: [
      "الخدمة موجّهة للراشدين. ويُتكفَّل بالقاصر عبر حساب أحد الوالدين أو الوصي أو مؤسسة مأذون لها.",
    ],
  },
  {
    titre: "9. تعديل هذه السياسة",
    paragraphes: [
      "إذا عُدِّلت هذه السياسة، يتغيّر تاريخ التحديث أعلاه، وتُعلَن التغييرات المهمّة داخل التطبيق.",
    ],
  },
];

const EN = [
  {
    titre: "1. Who we are",
    paragraphes: [
      "ASM (Assistance Sociale Médicale) operates the asm-sante.com website and mobile app, which let you book non-emergency medical transport, home care visits or pharmacy deliveries in the wilaya of Algiers, Algeria, and follow their progress. Contact: contact@asm-sante.com.",
    ],
  },
  {
    titre: "2. Data we collect",
    points: [
      { fort: "Identity and contact details", texte: "first and last name, phone number, email (optional), municipality, a relative's contact (optional)." },
      { fort: "Booking data", texte: "the services you request, pick-up and destination addresses, dates, time slots, and any instructions you enter." },
      { fort: "Documents", texte: "that you upload voluntarily (for example a prescription for a pharmacy delivery)." },
      { fort: "Account data", texte: "sign-in credentials (passwords are stored encrypted, never in plain text), language and notification preferences." },
      { fort: "Minimal technical data", texte: "needed to run and secure the service (server logs, anti-abuse protection). We do not use advertising cookies." },
    ],
  },
  {
    titre: "3. Why we use it",
    points: [
      { texte: "To arrange and carry out your services (booking, assigning a staff member, follow-up, invoicing)." },
      { texte: "To keep you informed: status notifications, messages from the team, appointment reminders." },
      { texte: "To secure accounts (sign-in codes, audit log of sensitive actions)." },
      { texte: "To improve the service (internal activity statistics, never sold on)." },
    ],
    paragraphes: ["We do not sell or rent your data to anyone."],
  },
  {
    titre: "4. Who can see your data",
    points: [
      { fort: "The ASM team", texte: "under strict roles enforced by our servers: each member sees only what their job requires, and sensitive actions are logged." },
      { fort: "The staff member assigned", texte: "to your request (driver, care assistant, courier): only the information needed for the job — never your documents or your full history." },
      { fort: "A healthcare institution", texte: "only if you have authorised it (an authorisation you can revoke at any time from your account)." },
      { fort: "Our technical subcontractors", texte: "who host or transmit on our behalf: website and database hosting, sending SMS, emails and notifications. They do not use your data for their own purposes." },
    ],
  },
  {
    titre: "5. Retention",
    paragraphes: [
      "Your account data is kept for as long as the account is active. Service history is kept for management purposes and accounting obligations. If you delete your account, your sign-in credentials are deleted; the history is kept only to the extent required by law.",
    ],
  },
  {
    titre: "6. Your rights",
    points: [
      { texte: "View and correct your information from your account, or by contacting us." },
      { texte: "Revoke an authorisation given to an institution, at any time." },
      { texte: "Turn off notifications from your phone or your profile." },
      { texte: "Request deletion of your account and your data: from the dedicated page asm-sante.com/suppression-compte, by email at contact@asm-sante.com, or by phone; requests are handled within 30 days." },
    ],
  },
  {
    titre: "7. Security",
    paragraphes: [
      "Encrypted connections (HTTPS), passwords never stored in plain text nor visible (not even to our administrators), documents kept in private storage reachable only through signed temporary links, permissions checked server-side on every action, and an audit log of sensitive operations.",
    ],
  },
  {
    titre: "8. Children",
    paragraphes: [
      "The service is intended for adults. A minor is cared for through the account of a parent, a guardian, or an authorised institution.",
    ],
  },
  {
    titre: "9. Changes to this policy",
    paragraphes: [
      "If this policy changes, the update date above changes with it, and significant changes are announced in the app.",
    ],
  },
];

export const POLITIQUE = {
  fr: { titre: "Politique de confidentialité", maj: MAJ, sections: FR },
  ar: { titre: "سياسة الخصوصية", maj: MAJ_AR, sections: AR },
  en: { titre: "Privacy Policy", maj: MAJ_EN, sections: EN },
};

// Mention affichée sur les versions traduites. Trois documents présentés
// comme équivalents seraient un engagement qu'on ne peut pas tenir : une
// nuance de traduction deviendrait opposable.
export const PRIMAUTE = {
  ar: "هذه ترجمة للتيسير. النص الفرنسي هو المرجع في حال الاختلاف.",
  en: "This is a courtesy translation. The French version prevails in case of discrepancy.",
};

export const RESUME_AR =
  "نحمي بياناتكم: لا نجمع إلا ما يلزم لتقديم الخدمة، ولا نبيع بياناتكم أبداً، ويمكنكم طلب حذف حسابكم في أي وقت.";

// Conservé tel quel : c'est ce que /api/confidentialite renvoie et ce que
// l'application DÉJÀ INSTALLÉE attend. Changer cette forme casserait les
// versions en circulation.
export const SECTIONS = FR;
