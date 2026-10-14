export type Locale = "en" | "fr";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  brand: "Meeting → Actions",
  nav: { new: "New", history: "History" },
  language: { label: "Language", switchTo: "Switch language" },
  footer: {
    disclaimer: "AI output is a draft. Verify facts before acting or sending.",
  },
  home: {
    title: "New meeting",
    description:
      "Paste a transcript to generate minutes, decisions, action items, a follow-up email and a project update.",
    loading: "Loading form…",
    samplePrompt: "No transcript handy? Load a worked example instead.",
    sampleButton: "Load sample meeting",
  },
  form: {
    titleLabel: "Meeting title",
    titlePlaceholder: "Weekly product sync",
    dateLabel: "Date (optional)",
    datePlaceholder: "2026-09-18",
    seriesLabel: "Series (optional)",
    seriesHint: "Group recurring meetings, open actions carry over.",
    seriesNone: "Not part of a series",
    seriesNew: "+ Create new series",
    seriesNewLabel: "New series name",
    seriesNewPlaceholder: "Product & Onboarding",
    transcriptLabel: "Transcript",
    transcriptLoad: "Load .txt file",
    transcriptPlaceholder: "Paste the meeting transcript here…",
    submit: "Generate deliverables",
    submitting: "Starting…",
    submitHint: "Opening the meeting to generate results…",
    emptyError: "Please paste a transcript before generating.",
  },
  history: {
    title: "History",
    newMeeting: "+ New meeting",
    loading: "Loading meetings…",
    empty: "No meetings yet. Import a transcript to get started.",
    generationFailed: "generation failed",
    generating: "generating…",
    taskCounts: "{open} open / {total} tasks",
    taskCountsOne: "{open} open / 1 task",
  },
  meeting: {
    back: "← History",
    delete: "Delete",
    viewTranscript: "View transcript",
    imported: "Imported {date}",
    series: "Series: {title}",
    loading: "Loading meeting…",
    notFound: "Meeting not found",
    notFoundHint: "Demo history is ephemeral — instances don't share it. Import a transcript or load the sample to see a full meeting.",
  },
  generation: {
    generating: "Generating deliverables…",
    stopped: "Generation stopped",
    failed: "Generation failed",
    failedHint: "Free models occasionally fail. Retry to try again.",
    progress:
      "Drafting results as they are ready · {done}/{total} sections · {elapsed}",
    retry: "Retry",
    notes: "Model working notes",
  },
  recap: {
    edit: "Edit",
    regenerate: "Regenerate",
    copy: "Copy",
    copied: "Copied",
    inferredHint: "“inferred” means guessed from the transcript, worth a check.",
    generated: "Generated {date} · {model}",
    generatedNoModel: "Generated {date}",
    notGenerated: "Not generated yet",
    edited: "edited",
    inferred: "inferred",
    overviewDecisions: "{count} decisions",
    overviewDecisionsOne: "1 decision",
    overviewActions: "{count} actions",
    overviewActionsOne: "1 action",
    overviewOpen: "{count} open",
    overviewOpenOne: "1 open",
    unassigned: "{count} unassigned",
    allDone: "All actions done, nice.",
    discussionDetails: "Discussion details",
    exportsTitle: "Copy-ready",
    emailTab: "Email",
    projectTab: "Project update",
    noOwner: "Needs owner",
    noDue: "No due date",
  },
  sections: {
    minutes: "Meeting minutes",
    decisions: "Decisions",
    open_questions: "Open questions",
    action_items: "Action items",
    follow_up_email: "Follow-up email",
    project_update: "Project update",
  },
  project: {
    progress: "Progress",
    blockers: "Blockers",
    nextSteps: "Next steps",
  },
  review: {
    save: "Save changes",
    saving: "Saving…",
    saved: "Saved",
    saveFailed: "Save failed",
    unsaved: "Unsaved changes",
    regenerate: "Regenerate",
    retry: "Retry",
    done: "Done",
    decisionPlaceholder: "Decision",
    contextPlaceholder: "Context (optional)",
    questionPlaceholder: "Question",
    add: "+ Add",
    remove: "Remove",
    addActionItem: "+ Add action item",
    taskPlaceholder: "Task",
    doneLabel: "done",
    ownerPlaceholder: "Owner (not specified)",
    duePlaceholder: "Due date (not specified)",
    subjectPlaceholder: "Subject",
    summaryPlaceholder: "Summary",
    statusTitle: "How certain is this value?",
  },
  status: { explicit: "explicit", inferred: "inferred", unknown: "unknown" },
  common: { none: "None recorded." },
};

export type Dictionary = typeof en;

const fr: Dictionary = {
  brand: "Meeting → Actions",
  nav: { new: "Nouveau", history: "Historique" },
  language: { label: "Langue", switchTo: "Changer de langue" },
  footer: {
    disclaimer:
      "Le résultat de l'IA est un brouillon. Vérifiez les faits avant d'agir ou d'envoyer.",
  },
  home: {
    title: "Nouvelle réunion",
    description:
      "Collez une transcription pour générer le compte rendu, les décisions, les actions, un e-mail de suivi et une mise à jour de projet.",
    loading: "Chargement du formulaire…",
    samplePrompt: "Pas de transcription sous la main ? Chargez un exemple.",
    sampleButton: "Charger un exemple de réunion",
  },
  form: {
    titleLabel: "Titre de la réunion",
    titlePlaceholder: "Point produit hebdomadaire",
    dateLabel: "Date (facultatif)",
    datePlaceholder: "2026-09-18",
    seriesLabel: "Série (facultatif)",
    seriesHint: "Regroupe les réunions récurrentes, les actions suivent.",
    seriesNone: "Hors série",
    seriesNew: "+ Créer une nouvelle série",
    seriesNewLabel: "Nom de la nouvelle série",
    seriesNewPlaceholder: "Produit & Onboarding",
    transcriptLabel: "Transcription",
    transcriptLoad: "Charger un fichier .txt",
    transcriptPlaceholder: "Collez la transcription de la réunion ici…",
    submit: "Générer le compte rendu",
    submitting: "Démarrage…",
    submitHint: "Ouverture de la réunion pour générer les résultats…",
    emptyError: "Veuillez coller une transcription avant de générer.",
  },
  history: {
    title: "Historique",
    newMeeting: "+ Nouvelle réunion",
    loading: "Chargement des réunions…",
    empty: "Aucune réunion. Importez une transcription pour commencer.",
    generationFailed: "génération échouée",
    generating: "génération…",
    taskCounts: "{open} en cours / {total} tâches",
    taskCountsOne: "{open} en cours / 1 tâche",
  },
  meeting: {
    back: "← Historique",
    delete: "Supprimer",
    viewTranscript: "Voir la transcription",
    imported: "Importé le {date}",
    series: "Série : {title}",
    loading: "Chargement de la réunion…",
    notFound: "Réunion introuvable",
    notFoundHint: "L'historique de démo est éphémère — les instances ne le partagent pas. Importez une transcription ou chargez l'exemple pour voir une réunion complète.",
  },
  generation: {
    generating: "Génération du compte rendu…",
    stopped: "Génération interrompue",
    failed: "Échec de la génération",
    failedHint: "Les modèles gratuits échouent parfois. Réessayez.",
    progress:
      "Rédaction progressive · {done}/{total} sections · {elapsed}",
    retry: "Réessayer",
    notes: "Notes de travail du modèle",
  },
  recap: {
    edit: "Modifier",
    regenerate: "Régénérer",
    copy: "Copier",
    copied: "Copié",
    inferredHint: "« déduit » = deviné depuis la transcription, à vérifier.",
    generated: "Généré le {date} · {model}",
    generatedNoModel: "Généré le {date}",
    notGenerated: "Pas encore généré",
    edited: "modifié",
    inferred: "déduit",
    overviewDecisions: "{count} décisions",
    overviewDecisionsOne: "1 décision",
    overviewActions: "{count} actions",
    overviewActionsOne: "1 action",
    overviewOpen: "{count} en suspens",
    overviewOpenOne: "1 en suspens",
    unassigned: "{count} sans responsable",
    allDone: "Toutes les actions sont terminées, bravo.",
    discussionDetails: "Détail des discussions",
    exportsTitle: "Prêt à copier",
    emailTab: "E-mail",
    projectTab: "Mise à jour projet",
    noOwner: "Sans responsable",
    noDue: "Sans échéance",
  },
  sections: {
    minutes: "Compte rendu",
    decisions: "Décisions",
    open_questions: "Questions ouvertes",
    action_items: "Actions",
    follow_up_email: "E-mail de suivi",
    project_update: "Mise à jour du projet",
  },
  project: {
    progress: "Avancement",
    blockers: "Blocages",
    nextSteps: "Prochaines étapes",
  },
  review: {
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré",
    saveFailed: "Échec de l'enregistrement",
    unsaved: "Modifications non enregistrées",
    regenerate: "Régénérer",
    retry: "Réessayer",
    done: "Terminé",
    decisionPlaceholder: "Décision",
    contextPlaceholder: "Contexte (facultatif)",
    questionPlaceholder: "Question",
    add: "+ Ajouter",
    remove: "Supprimer",
    addActionItem: "+ Ajouter une action",
    taskPlaceholder: "Tâche",
    doneLabel: "fait",
    ownerPlaceholder: "Responsable (non précisé)",
    duePlaceholder: "Échéance (non précisée)",
    subjectPlaceholder: "Objet",
    summaryPlaceholder: "Résumé",
    statusTitle: "Quelle est la certitude de cette valeur ?",
  },
  status: { explicit: "explicite", inferred: "déduit", unknown: "inconnu" },
  common: { none: "Aucun élément." },
};

export const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "fr" ? "fr" : "en";
}

export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function localeTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(typeof value === "string" ? new Date(value) : value);
}
