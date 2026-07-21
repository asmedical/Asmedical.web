// Assistant ASM — scénarios guidés FR/AR, SANS dépendance externe.
// Un moteur à mots-clés honnête : il reconnaît l'intention, répond dans la
// langue de l'utilisateur et propose l'action utile (page ou appel). Il ne
// « devine » jamais : sans correspondance, il oriente vers un humain.
// Pur et testable — le composant visuel ne fait que l'appeler.

const NUMERO = "05 64 49 33 48";

// Intentions, par ordre de priorité (la première qui matche gagne).
// `cles` : fragments recherchés dans le texte normalisé (FR + AR + darija).
const INTENTIONS = [
  {
    id: "urgence",
    cles: ["urgence", "urgent", "grave", "malaise", "accident", "استعجال", "عاجل", "خطير"],
    fr: `Si c'est une urgence vitale, appelez d'abord le SAMU (16) ou Protection civile (14). Pour un transport médical urgent ASM, appelez-nous au ${NUMERO} — nous décrochons 7j/7.`,
    ar: `إذا كان الأمر استعجالاً حيوياً، اتصلوا أولاً بالإسعاف (16) أو الحماية المدنية (14). لنقل طبي عاجل مع ASM اتصلوا بنا على ${NUMERO} — نرد كل أيام الأسبوع.`,
    action: "appeler",
  },
  {
    id: "suivi",
    cles: ["suivre", "suivi", "où est", "ou est", "en retard", "retard", "chauffeur", "arrive", "تتبع", "أين", "وين", "تأخر", "السائق"],
    fr: "Vous pouvez suivre votre demande en direct (étapes, chauffeur, arrivée estimée) dans l'onglet Suivi.",
    ar: "يمكنكم تتبع طلبكم مباشرة (المراحل، السائق، وقت الوصول المقدر) في تبويب المتابعة.",
    action: "suivi",
  },
  {
    id: "annuler",
    cles: ["annuler", "annulation", "reporter", "déplacer", "changer la date", "إلغاء", "ألغي", "تأجيل", "نأجل"],
    fr: `Pour annuler ou déplacer un rendez-vous, appelez-nous au ${NUMERO} — c'est immédiat. Vous pouvez aussi écrire dans la discussion de votre demande (onglet Suivi).`,
    ar: `لإلغاء أو تأجيل موعد، اتصلوا بنا على ${NUMERO} — يتم فوراً. يمكنكم أيضاً الكتابة في نقاش طلبكم (تبويب المتابعة).`,
    action: "appeler",
  },
  {
    id: "medicaments",
    cles: ["médicament", "medicament", "ordonnance", "pharmacie", "livraison", "دواء", "أدوية", "وصفة", "صيدلية", "توصيل"],
    fr: "Nous livrons vos médicaments à domicile : vous joignez l'ordonnance en photo à la réservation, et vous pouvez renouveler la dernière commande en un bouton.",
    ar: "نوصّل أدويتكم إلى المنزل: ترفقون الوصفة كصورة عند الحجز، ويمكنكم تجديد آخر طلبية بزر واحد.",
    action: "medicaments",
  },
  {
    id: "prix",
    cles: ["prix", "tarif", "coût", "cout", "combien", "cher", "سعر", "أسعار", "تكلفة", "بشحال", "قداش"],
    fr: "Le prix exact s'affiche AVANT de confirmer votre réservation (estimation selon le trajet et l'horaire). Des packs tout compris existent aussi — regardez « Nos packs ».",
    ar: "يظهر السعر الدقيق قبل تأكيد الحجز (تقدير حسب المسار والتوقيت). توجد أيضاً باقات شاملة — اطّلعوا على « باقاتنا ».",
    action: "packs",
  },
  {
    id: "devis",
    cles: ["devis", "convention", "clinique", "centre", "établissement", "etablissement", "contrat", "عرض سعر", "اتفاقية", "عيادة", "مركز"],
    fr: "Pour un besoin régulier (famille ou établissement), demandez un devis : décrivez votre besoin et notre équipe vous recontacte avec une proposition chiffrée.",
    ar: "لحاجة منتظمة (عائلة أو مؤسسة)، اطلبوا عرض سعر: صفوا حاجتكم وسيتواصل معكم فريقنا بعرض مُسعَّر.",
    action: "devis",
  },
  {
    id: "famille",
    cles: ["parent", "ma mère", "ma mere", "mon père", "mon pere", "famille", "proche", "pour quelqu'un", "والدتي", "والدي", "أمي", "أبي", "قريب", "عائلة"],
    fr: "Vous pouvez réserver POUR un parent : ajoutez-le dans « Mes proches » (avec son accord, code ou validation), puis réservez et suivez ses prestations à sa place.",
    ar: "يمكنكم الحجز لقريب: أضيفوه في « أقاربي » (بموافقته، برمز أو تأكيد)، ثم احجزوا وتابعوا خدماته مكانه.",
    action: "proches",
  },
  {
    id: "compte",
    cles: ["connexion", "connecter", "compte", "code sms", "mot de passe", "inscription", "تسجيل", "حساب", "دخول", "رمز"],
    fr: "La connexion se fait avec votre numéro de téléphone : vous recevez un code par SMS (ou WhatsApp). Aucun mot de passe à retenir.",
    ar: "الدخول برقم هاتفكم: يصلكم رمز عبر SMS (أو واتساب). لا حاجة لكلمة سر.",
    action: "connexion",
  },
  {
    id: "paiement",
    cles: ["payer", "paiement", "facture", "reçu", "recu", "espèces", "especes", "cib", "dahabia", "دفع", "فاتورة", "وصل"],
    fr: "Vous payez en ligne (CIB/EDAHABIA) ou avec un ticket d'agence (espèces réglées à l'agence) — jamais au coursier ni à l'auxiliaire. Vos factures et reçus sont dans « Paiements & factures ».",
    ar: "تدفعون عبر الإنترنت (CIB/الذهبية) أو بتذكرة الوكالة (نقداً في الوكالة) — وليس للموصِّل أو لمقدّم الخدمة. فواتيركم ووصولاتكم في « المدفوعات والفواتير ».",
    action: "paiements",
  },
  {
    id: "horaires",
    cles: ["horaire", "ouvert", "quelle heure", "disponible", "week", "vendredi", "توقيت", "مفتوح", "متاح", "الجمعة"],
    fr: "Nous intervenons 7j/7, de 7h à 19h (urgences transport possibles en dehors — appelez-nous).",
    ar: "نعمل كل أيام الأسبوع من 7 صباحاً إلى 7 مساءً (النقل المستعجل ممكن خارجها — اتصلوا بنا).",
  },
  {
    id: "humain",
    cles: ["parler", "conseiller", "quelqu'un", "humain", "appeler", "شخص", "مستشار", "إنسان", "اتصال"],
    fr: `Bien sûr ! Appelez-nous au ${NUMERO} (7j/7) — ou par WhatsApp au même numéro.`,
    ar: `بالطبع! اتصلوا بنا على ${NUMERO} (كل أيام الأسبوع) — أو عبر واتساب على نفس الرقم.`,
    action: "appeler",
  },
];

function normaliser(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Répond à un texte libre. Retourne { id, txt, action? } — id "defaut" si
// aucune intention reconnue (repli honnête vers un humain).
export function repondreAssistant(texte, langue = "fr") {
  const t = normaliser(texte);
  const brut = String(texte || ""); // l'arabe se compare sans normalisation NFD
  for (const intention of INTENTIONS) {
    if (intention.cles.some((c) => (/[؀-ۿ]/.test(c) ? brut.includes(c) : t.includes(normaliser(c))))) {
      return { id: intention.id, txt: langue === "ar" ? intention.ar : intention.fr, action: intention.action };
    }
  }
  return {
    id: "defaut",
    txt:
      langue === "ar"
        ? `سجّلت سؤالكم! للحصول على رد دقيق، اتصلوا على ${NUMERO} أو اتركوا رقمكم — نعاود الاتصال خلال أقل من 30 دقيقة.`
        : `Je note votre question ! Pour une réponse précise, appelez le ${NUMERO} ou laissez votre numéro — un conseiller vous rappelle en moins de 30 minutes.`,
    action: "appeler",
  };
}

// Libellé du bouton d'action proposé sous une réponse (null = aucun).
export function libelleAction(action, langue = "fr") {
  const L = {
    suivi: ["Ouvrir le suivi", "فتح المتابعة"],
    packs: ["Voir nos packs", "عرض باقاتنا"],
    abonnements: ["Voir les abonnements", "عرض الاشتراكات"],
    devis: ["Demander un devis", "طلب عرض سعر"],
    proches: ["Gérer mes proches", "إدارة أقاربي"],
    paiements: ["Mes paiements", "مدفوعاتي"],
    connexion: ["Me connecter", "تسجيل الدخول"],
    rdv: ["Prendre rendez-vous", "حجز موعد"],
    medicaments: ["Réserver une livraison", "حجز توصيل"],
    appeler: ["Nous appeler", "اتصلوا بنا"],
  };
  const l = L[action];
  return l ? (langue === "ar" ? l[1] : l[0]) : null;
}

// Cible de navigation de chaque action (le composant fait le reste).
export const CIBLES_ACTION = {
  suivi: "/suivi",
  packs: "/packs",
  abonnements: "/abonnements",
  devis: "/devis",
  proches: "/compte/proches",
  paiements: "/compte/paiements",
  connexion: "/connexion",
  rdv: "/rdv",
  medicaments: "/rdv",
};
