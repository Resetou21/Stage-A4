export const BOARD_IDS = {
  TABLEAU_COMPLET_CHANTIER: '1976599627',
  INVENTAIRES_CONSOMMABLES: '5105902205',
  VISITES_CLIENTS: '1977798116',
  COMMUNICATION_ANIMATRICES: '5044808167',
  SUBITEMS_VISITES_CLIENTS: '1978388826',
} as const;

export interface ColumnMeta {
  id: string;
  title: string;
  type: string;
}

export const COLUMN_MAP: Record<string, Record<string, ColumnMeta>> = {
  [BOARD_IDS.TABLEAU_COMPLET_CHANTIER]: {
    animateur: { id: 'color_mkrbk3jy', title: 'ANIMATEUR', type: 'status' },
    datePrvRdvDes2Mois: { id: 'date_mkzbpth5', title: '🅰️Date prév RDv des 2 mois', type: 'date' },
    rdv2Mois: { id: 'boolean_mkzad1h', title: 'Rdv 2 mois ?', type: 'checkbox' },
    c1: { id: 'color_mkzyz3ay', title: 'C1', type: 'status' },
    c2: { id: 'color_mkzyx621', title: 'C2', type: 'status' },
    c3: { id: 'color_mkzycd34', title: 'C3', type: 'status' },
    rsultatDernierContrle: { id: 'color_mkzyheka', title: '🅰️Résultat dernier contrôle', type: 'status' },
    dernierContrle: { id: 'date_mkzy6s01', title: '🅰️Dernier contrôle', type: 'date' },
    dernierContrle1: { id: 'date_mkzy5nw9', title: 'Dernier contrôle', type: 'date' },
    alerte2: { id: 'formula_mkzzfvq1', title: 'Alerte 2', type: 'formula' },
    alerte3: { id: 'formula_mkzzqbf3', title: 'Alerte 3', type: 'formula' },
    column3: { id: 'formula_mkzzabga', title: '3🌟', type: 'formula' },
    column2: { id: 'formula_mkzzk0qv', title: '2🌟', type: 'formula' },
    column1: { id: 'formula_mkzzxqe8', title: '1🌟', type: 'formula' },
    column: { id: 'formula_mkzzevbg', title: '🙁', type: 'formula' },
    calExtractDates: { id: 'text_mkx19mqq', title: 'Cal extract dates', type: 'text' },
    // Candidats pour texteDalerteAnimatrice1: text_mkzbnbe9 (texte renseigné) vs formula_mkzbfgx0 (formule)
    texteDalerteAnimatrice1: { id: 'text_mkzbnbe9', title: "🅰️Texte d'alerte animatrice", type: 'text' },
    codeChantier: { id: 'text_mm2kscgb', title: 'Code Chantier', type: 'text' },
    adresse: { id: 'text_mm3k9x1n', title: 'ADRESSE', type: 'text' },
    codePostal: { id: 'numeric_mkrba3xc', title: 'CODE POSTAL', type: 'numbers' },
    ville: { id: 'color_mkrb1yqe', title: 'VILLE', type: 'status' },
    interlocuteur: { id: 'dropdown_mkrb9ma', title: 'INTERLOCUTEUR', type: 'dropdown' },
    telephone: { id: 'dropdown_mkrbfhrg', title: 'TELEPHONE', type: 'dropdown' },
    email: { id: 'dropdown_mkrbwbya', title: 'ADRESSE MAIL', type: 'dropdown' },
    cle: { id: 'text_mkrb5wn0', title: 'N° de CLEF', type: 'text' },
    doubleCle: { id: 'text_mkrbmf98', title: 'Double des clés', type: 'text' },
    keycafe: { id: 'text_mkwpfnx6', title: 'keycafe ou boite à clé classique', type: 'text' },
    cahierLiaison: { id: 'text_mkrb280x', title: 'Cahier de liaison', type: 'text' },
    heuresMois: { id: 'numeric_mkxwwma1', title: 'H  par mois', type: 'numbers' },
    activite: { id: 'color_mm0v1k6a', title: 'Activité', type: 'status' },
    sensible: { id: 'boolean_mm0v3fg', title: 'Sensible ?', type: 'checkbox' },
  },

  [BOARD_IDS.VISITES_CLIENTS]: {
    dateVisiteClient: { id: 'date_mkrcgy18', title: 'Date visite client', type: 'date' },
    qualitDeLaPrestation: { id: 'status', title: 'Qualité de la prestation👀', type: 'status' },
    nomChantier: { id: 'board_relation_mktd1vha', title: 'NOM CHANTIER', type: 'board_relation' },
    animateur: { id: 'lookup_mkvgpaca', title: 'Animateur', type: 'mirror' },
    animatriceDirect: { id: 'color_mkvvxc1d', title: 'Animatrice', type: 'status' },
  },

  [BOARD_IDS.SUBITEMS_VISITES_CLIENTS]: {
    actionMener: { id: 'text_mkrhcpzc', title: 'Action à mener', type: 'text' },
    statut: { id: 'color_mkv1tk6f', title: 'Statut', type: 'status' },
    dateRalisation: { id: 'date_mkwrr950', title: 'Date réalisation', type: 'date' },
    catgorie: { id: 'dropdown_mkv1j4z1', title: 'Catégorie', type: 'dropdown' },
  },

  [BOARD_IDS.COMMUNICATION_ANIMATRICES]: {
    vu: { id: 'boolean_mkwrnzkb', title: '✅Vu', type: 'checkbox' },
    date: { id: 'date_mkwrkqy5', title: 'Date', type: 'date' },
    clientConcern: { id: 'board_relation_mkwrnhwg', title: 'Client concerné', type: 'board_relation' },
    personneConcerne: { id: 'color_mkzat86a', title: 'Personne concernée', type: 'status' },
  },

  [BOARD_IDS.INVENTAIRES_CONSOMMABLES]: {
    tableauCompletChantier: { id: 'board_relation_mm82mpb7', title: 'Tableau complet chantier', type: 'board_relation' },
    animateur: { id: 'lookup_mm823rxr', title: 'Animateur', type: 'mirror' },
    fournisseur: { id: 'lookup_mm86k78e', title: 'Fournisseur', type: 'mirror' },
    codeChantierFournisseur: { id: 'text_mm84x47n', title: 'Code Chantier Fournisseur', type: 'text' },
    familleDeProduits: { id: 'dropdown_mm86pdrz', title: 'Famille de produits', type: 'dropdown' },
    dateInventaireActuel: { id: 'date_mm843j0k', title: 'Date Inventaire Actuel', type: 'date' },
    inventaireValidOk: { id: 'boolean_mm84z0a4', title: 'Inventaire Validé (OK)', type: 'checkbox' },
    rcuprationRalise: { id: 'boolean_mm8cddz6', title: 'Récupération réalisée', type: 'checkbox' },
    avenantRalis: { id: 'boolean_mm8capb3', title: 'Avenant réalisé', type: 'checkbox' },
    economieDirecte: { id: 'formula_mm8ccrzs', title: '🏁Economie Directe', type: 'formula' },
    economie12Mois: { id: 'formula_mm8czcsd', title: '🏁Économie 12 mois', type: 'formula' },

    // 1. PH 300M
    ph300mContrat: { id: 'lookup_mm85pxrs', title: '🧻PH 300M - Contrat', type: 'mirror' },
    ph300mInventaire: { id: 'numeric_mm84zrr', title: '🧻PH 300M - Inventaire', type: 'numbers' },
    ph300mRcuprerAnimatrice: { id: 'formula_mm8495d7', title: '🏁PH 300M - À récupérer', type: 'formula' },
    ph300mAvenantSamira: { id: 'formula_mm843fxq', title: '🏁PH 300M - Avenant', type: 'formula' },
    puHtPh300m: { id: 'lookup_mm8cx8tc', title: 'PU HT  PH 300M', type: 'mirror' },

    // 2. PH 60M
    Ph60mContrat: { id: 'lookup_mm852sfg', title: '🧻 PH 60M - Contrat', type: 'mirror' },
    Ph60mInventaire: { id: 'numeric_mm84daj5', title: '🧻 PH 60M - Inventaire', type: 'numbers' },
    ph60mRcuprer: { id: 'formula_mm84c6fm', title: '🏁PH 60M - À récupérer', type: 'formula' },
    ph60mAvenant: { id: 'formula_mm84bhs5', title: '🏁PH 60M - Avenant', type: 'formula' },
    puHt60m: { id: 'lookup_mm8c28rg', title: 'PU HT 60M', type: 'mirror' },

    // 3. PH 22 M
    ph22MContrat: { id: 'lookup_mm85we3j', title: '🧻PH 22 M - Contrat', type: 'mirror' },
    ph22MInventaire: { id: 'numeric_mm84zbn6', title: '🧻PH 22 M - Inventaire', type: 'numbers' },
    ph22MRcuprer: { id: 'formula_mm842h30', title: '🏁PH 22 M - À récupérer', type: 'formula' },
    ph22MAvenant: { id: 'formula_mm8459b9', title: '🏁PH 22 M - Avenant', type: 'formula' },
    puHt22m: { id: 'lookup_mm8c67k8', title: 'PU HT 22M', type: 'mirror' },

    // 4. Recharge EM autocut
    rechargeEmAutocutContrat: { id: 'lookup_mm859yck', title: '🧻Recharge EM autocut - Contrat', type: 'mirror' },
    rechargeEmAutocutInventaire: { id: 'numeric_mm84htpa', title: '🧻Recharge EM autocut - Inventaire', type: 'numbers' },
    emAutocutRcuprer: { id: 'formula_mm84j9h6', title: '🏁EM AUTOCUT - À récupérer', type: 'formula' },
    s508EmAutocutAvenant: { id: 'formula_mm84qb11', title: '🏁EM AUTOCUT - Avenant', type: 'formula' },
    puHtEmAutocut: { id: 'lookup_mm8cc0mt', title: 'PU HT EM AUTOCUT', type: 'mirror' },

    // 5. EM feuille à feuille
    EmFeuilleAFeuilleContrat: { id: 'lookup_mm856gem', title: '🧻 EM FEUILLE A FEUILLE - Contrat', type: 'mirror' },
    EmFeuilleAFeuilleInventaire: { id: 'numeric_mm84srg1', title: '🧻 EM FEUILLE A FEUILLE - Inventaire', type: 'numbers' },
    emFeuilleAFeuilleRcuprer: { id: 'formula_mm845bgw', title: '🏁EM FEUILLE A FEUILLE - À récupérer', type: 'formula' },
    emFeuilleAFeuilleAvenant: { id: 'formula_mm84d9ha', title: '🏁EM FEUILLE A FEUILLE - Avenant', type: 'formula' },
    puHtEmFeuilleAFeuille: { id: 'lookup_mm8cxksc', title: 'PU HT EM FEUILLE A FEUILLE', type: 'mirror' },

    // 6. EM bobine textile
    EmBobineTextileContrat: { id: 'lookup_mm8526t8', title: '🧻 EM BOBINE TEXTILE - Contrat', type: 'mirror' },
    EmBobineTextileInventaire: { id: 'numeric_mm84bmk4', title: '🧻 EM BOBINE TEXTILE - Inventaire', type: 'numbers' },
    emBobineTextileRcuprer: { id: 'formula_mm84cmq6', title: '🏁EM BOBINE TEXTILE - À récupérer', type: 'formula' },
    emBobineTextileAvenant: { id: 'formula_mm84sjcp', title: '🏁EM BOBINE TEXTILE - Avenant', type: 'formula' },
    puHtEmBobineTextile: { id: 'lookup_mm8c9hq5', title: 'PU HT EM BOBINE TEXTILE', type: 'mirror' },

    // 7. Savon 400 ML
    Savon400MlContrat: { id: 'lookup_mm85t7rz', title: '🧻 Savon  400 ML - Contrat', type: 'mirror' },
    Savon400MlInventaire: { id: 'numeric_mm84dvdt', title: '🧻 Savon  400 ML - Inventaire', type: 'numbers' },
    savon400MlRcuprer: { id: 'formula_mm84k9vs', title: '🏁Savon 400 ML - À récupérer', type: 'formula' },
    savon400MlAvenant: { id: 'formula_mm841e9z', title: '🏁Savon 400 ML - Avenant', type: 'formula' },
    puHtSavon400ml: { id: 'lookup_mm8c2jsh', title: 'PU HT Savon 400ml', type: 'mirror' },

    // 8. Savon mousse 1L
    savonMousse1lInventaireContrat: { id: 'lookup_mm85g0xq', title: '🧻 Savon Mousse 1L - Contrat', type: 'mirror' },
    savonMousse1lInventaire: { id: 'numeric_mm84cxj', title: '🧻 Savon Mousse 1L - Inventaire', type: 'numbers' },
    savonMousse1lRcuprer: { id: 'formula_mm84z4h7', title: '🏁Savon Mousse 1L - À récupérer', type: 'formula' },
    savonMousse1lAvenant: { id: 'formula_mm844bye', title: '🏁Savon Mousse 1L - Avenant', type: 'formula' },
    puHtSavonMousse1L: { id: 'lookup_mm8cnb7x', title: 'PU HT Savon Mousse 1 L', type: 'mirror' },

    // 9. Savon ECOLAB 5L
    SavonEcolab5lContrat: { id: 'lookup_mm859yv9', title: '🧻 Savon ECOLAB 5L - Contrat', type: 'mirror' },
    SavonEcolab5lInventaire: { id: 'numeric_mm84ycgq', title: '🧻 Savon ECOLAB 5L - Inventaire', type: 'numbers' },
    savonEcolab5lRcuprer: { id: 'formula_mm84ceda', title: '🏁Savon ECOLAB 5L - À récupérer', type: 'formula' },
    savonEcolab5lAvenant: { id: 'formula_mm84qx4p', title: '🏁Savon ECOLAB 5L - Avenant', type: 'formula' },
    puHtSavonEcolab5l: { id: 'lookup_mm8cp9pt', title: 'PU HT Savon ECOLAB 5L', type: 'mirror' },

    // 10. Savon KLINT V 2L
    kalhygeS262RechAppaSavKlintV2lContrat: { id: 'lookup_mm85hmk4', title: '🧻 Savon KLINT V 2L- Contrat', type: 'mirror' },
    SavonKlintV2l: { id: 'numeric_mm84xaax', title: '🧻 Savon KLINT V 2L - Inventaire', type: 'numbers' },
    savonKlintV2lRcuprer: { id: 'formula_mm84stet', title: '🏁Savon KLINT V 2L - À récupérer', type: 'formula' },
    savonKlintV2lAvenant: { id: 'formula_mm84cm2a', title: '🏁Savon KLINT V 2L - Avenant', type: 'formula' },
    puHtSavonKlintV2l: { id: 'lookup_mm8cm7h1', title: 'PU HT Savon KLINT V 2L', type: 'mirror' },

    // 11. Savon 4L
    kalhygeS713RechSavAEcomax4lContrat: { id: 'lookup_mm85bk9x', title: '🧻 Savon 4L - Contrat', type: 'mirror' },
    Savon4l: { id: 'numeric_mm847ymc', title: '🧻 Savon 4L - Inventaire', type: 'numbers' },
    savon4lRcuprer: { id: 'formula_mm84h784', title: '🏁Savon 4L - À récupérer', type: 'formula' },
    savon4lAvenant: { id: 'formula_mm849yb8', title: '🏁Savon 4L - Avenant', type: 'formula' },
    puHtSavon4l: { id: 'lookup_mm8ckdje', title: 'PU HT Savon 4L', type: 'mirror' },

    // 12. Recharge parfum
    kalhygeS663RechDifpPwPassionMangContrat: { id: 'lookup_mm85mbzk', title: '🧻 Recharge parfum - Contrat', type: 'mirror' },
    RechargeParfum: { id: 'numeric_mm843yr6', title: '🧻 Recharge parfum - Inventaire', type: 'numbers' },
    rechargeParfumRcuprer: { id: 'formula_mm84gq6b', title: '🏁Recharge parfum - À récupérer', type: 'formula' },
    rechargeParfumAvenant: { id: 'formula_mm849e83', title: '🏁Recharge parfum - Avenant', type: 'formula' },
    puHtRechargeParfum: { id: 'lookup_mm8cpjeh', title: 'PU HT Recharge Parfum', type: 'mirror' },

    // 13. Grilles urinoir
    kalhygeS647RechDesfGrilUrinManguContrat: { id: 'lookup_mm853ndb', title: '🧻 Grilles urinoir - Contrat', type: 'mirror' },
    GrillesUrinoir: { id: 'numeric_mm847wj9', title: '🧻 Grilles urinoir - Inventaire', type: 'numbers' },
    grillesUrinoirRcuprer: { id: 'formula_mm84x5b0', title: '🏁Grilles urinoir - À récupérer', type: 'formula' },
    grillesUrinoirAvenant: { id: 'formula_mm84n6t', title: '🏁Grilles urinoir - Avenant', type: 'formula' },
    puHtGrilleUrinoir: { id: 'lookup_mm8c4b0w', title: 'PU HT Grille Urinoir', type: 'mirror' },

    // 14. Hygiène féminine citron
    kalhygeS365RechAppaHygfDboCitronContrat: { id: 'lookup_mm85a5fe', title: '🧻Hygiène féminine Citron - Contrat', type: 'mirror' },
    hygineFminineCitron: { id: 'numeric_mm846h2q', title: '🧻Hygiène féminine Citron - Inventaire', type: 'numbers' },
    hygineFminineCitronRcuprer: { id: 'formula_mm84jwdm', title: '🏁Hygiène féminine Citron - À récupérer', type: 'formula' },
    hygineFminineCitronAvenant: { id: 'formula_mm84fjv', title: '🏁Hygiène féminine Citron - Avenant', type: 'formula' },
    puHtHygineFminine: { id: 'lookup_mm8csbyp', title: 'PU HT Hygiène féminine', type: 'mirror' },

    // 15. Savon atelier 2L
    initial95974SavonAtelierKrestoCitrus2lContrat: { id: 'lookup_mm85y3cr', title: '🧻 Savon atelier 2L - Contrat', type: 'mirror' },
    SavonAtelier2l: { id: 'numeric_mm84qcw2', title: '🧻 Savon atelier 2L - Inventaire', type: 'numbers' },
    savonAtelier2lRcuprer: { id: 'formula_mm8475zc', title: '🏁Savon atelier 2L - À récupérer', type: 'formula' },
    savonAtelier2lAvenant: { id: 'formula_mm8416h3', title: '🏁Savon atelier 2L - Avenant', type: 'formula' },
    puHtSavonAtelier2l: { id: 'lookup_mm8cv03k', title: 'PU HT Savon atelier 2L', type: 'mirror' },

    // 16. EM rouleaux 160m
    initial420705EmRouleaux160mCx6Contrat: { id: 'lookup_mm86esbe', title: '🧻EM ROULEAUX 160m - Contrat', type: 'mirror' },
    emRouleaux160m: { id: 'numeric_mm863b6x', title: '🧻EM ROULEAUX 160m - Inventaire', type: 'numbers' },
    emRouleaux160mRcuprer: { id: 'formula_mm86gsfe', title: '🏁EM ROULEAUX 160m - À récupérer', type: 'formula' },
    emRouleaux160mAvenant: { id: 'formula_mm868jwa', title: '🏁EM ROULEAUX 160m - Avenant', type: 'formula' },
    puHtEmRouleaux160m: { id: 'lookup_mm8cysg8', title: 'PU HT EM ROULEAUX 160m', type: 'mirror' },
  },
};

export function getColumnMeta(boardId: string, fieldName: string): ColumnMeta | undefined {
  return COLUMN_MAP[boardId]?.[fieldName];
}

