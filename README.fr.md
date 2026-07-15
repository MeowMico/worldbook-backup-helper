# Worldbook Workbench

[English README](README.md)

[中文说明](README.zh-CN.md)

Worldbook Workbench est une extension SillyTavern qui permet de modifier, versionner, comparer, restaurer et exporter des worldbooks/lorebooks.

Elle est conçue pour les créateurs qui testent leurs sorties de jeu de rôle tout en révisant activement leur univers, leurs notes de personnages, leurs règles ou leurs entrées de contexte. Au lieu d'exporter manuellement un fichier JSON avant chaque changement, vous pouvez travailler directement dans SillyTavern et conserver un historique local des modifications de vos worldbooks.

## Fonctionnalités

- Modifier des worldbooks SillyTavern directement dans un espace de travail intégré à Tavern.
- Utiliser des vues séparées `Worldbooks`, `Entrées`, `Modifier` et `Historique` sur téléphone et écran étroit, sans modifier l'espace de travail à trois colonnes sur ordinateur.
- Enregistrer automatiquement un instantané `Origin` la première fois qu'un worldbook est ouvert.
- Créer des expériences nommées avec des instantanés avant/après pour tester un changement précis.
- Comparer la version actuelle, la version précédente, la base, le résultat et les versions enregistrées avec des différences surlignées.
- Restaurer l'origine, le résultat d'une expérience ou toute version enregistrée.
- Rechercher des mots-clés dans les entrées du worldbook, passer d'une occurrence à l'autre, remplacer des occurrences ou les supprimer.
- Sélectionner plusieurs entrées pour les activer, les désactiver, les supprimer ou les copier vers un autre worldbook tout en conservant leur contenu et leurs paramètres.
- Associer des presets MVU InitVar aux salutations de personnage et aux swipes d'ouverture du chat actuel pour les tests côté auteur.
- Renommer des expériences, ajouter des notes d'expérience et rechercher dans l'historique des expériences.
- Exporter une seule expérience/version en JSON ou exporter tout l'historique local d'un worldbook.
- Interface disponible en anglais et en chinois.
- Thèmes clair et sombre inclus.

Le flux de modification standard fonctionne avec les worldbooks/lorebooks. L'onglet facultatif `MVU InitVar` lit les salutations de la carte de personnage actuelle et les swipes d'ouverture du chat actuel uniquement lorsque vous utilisez ce flux de travail.

## Installation

Ouvrez SillyTavern et installez ce dépôt comme extension tierce :

```text
Extensions -> Install extension -> paste this repository URL
```

URL du dépôt :

```text
https://github.com/MeowMico/worldbook-backup-helper
```

Après l'installation, ouvrez l'extension depuis le menu des extensions de SillyTavern.

## Extension autonome pour VS Code / Cursor

Ce dépôt fournit également une version autonome pour VS Code, Cursor et les éditeurs compatibles. Elle ouvre directement les fichiers JSON de worldbook, permet les modifications par lot et la copie entre fichiers, puis affiche l'ordre final des entrées dans les messages system/user/assistant. Les instantanés, expériences, Diff et restaurations sont conservés dans un fichier latéral `<worldbook>.wbh-history.json`, sans ajouter de métadonnées au JSON du worldbook.

La version autonome propose 80 étapes d'annulation et de rétablissement pendant la session. La saisie continue dans un champ est regroupée en une étape, tandis que la création, la duplication, l'activation, la suppression, les remplacements groupés et Apply JSON constituent chacun une étape complète. Après Save ou Restore, les instantanés persistants prennent le relais.

L'interface autonome peut suivre automatiquement la langue de VS Code ou Cursor, ou être forcée en anglais ou en chinois simplifié. Le changement s'applique à l'espace de travail ouvert sans supprimer les modifications non enregistrées.

Installez-la depuis la place de marché utilisée par votre éditeur :

- Microsoft Visual Studio Code : [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MeowMico.worldbook-workbench-vscode)
- Cursor, VSCodium et les autres clients Open VSX : [Open VSX](https://open-vsx.org/extension/meowmico/worldbook-workbench-vscode)

Consultez le [guide d'utilisation en anglais](packages/vscode-extension/USER_GUIDE.md) ou le [guide en chinois simplifié](packages/vscode-extension/USER_GUIDE.zh-CN.md) pour le flux complet de modification, d'aperçu et d'historique.

L'installation depuis une place de marché est recommandée afin de recevoir les mises à jour normales. L'installation manuelle d'un fichier `.vsix` est principalement destinée aux tests locaux.

## Flux de travail recommandé

1. Ouvrez `Worldbook Workbench`.
2. Sélectionnez un worldbook.
3. Cliquez sur `Start` et nommez l'expérience, par exemple `réduire les formulations mécaniques` ou `renforcer les règles de la ville`.
4. Modifiez les entrées dans l'espace de travail.
5. Cliquez sur `Save` pour écrire le worldbook dans SillyTavern.
6. Utilisez `Diff` pour comparer la base et la version après modification.
7. Marquez l'expérience comme `Keep` ou `Reject`, ajoutez une note si nécessaire, ou restaurez une version précédente.

`Save` n'est pas une simple action d'enregistrement dans un brouillon. Elle écrit le worldbook modifié directement dans les données natives de SillyTavern, sans étape d'enregistrement supplémentaire dans l'éditeur natif. Un instantané avant l'enregistrement et un instantané après l'enregistrement sont créés automatiquement.

Si vous modifiez le worldbook dans l'éditeur natif de SillyTavern plutôt que dans l'espace de travail, cliquez sur `Finish` après le changement pour capturer l'instantané après modification.

## Modification dans le Workbench

L'onglet `Edit` prend en charge les champs courants des entrées de worldbook SillyTavern, notamment :

- titre/commentaire
- contenu
- clés principales et secondaires
- constant, désactivé, sélectif, vectorisé
- position d'insertion, rôle, profondeur, ordre, probabilité
- récursion, groupes, analyse, déclencheurs, filtres de personnages et sources de correspondance
- sticky, cooldown, délai, ID d'automatisation et champs outlet/ancre

La première fois qu'un worldbook est ouvert, son état actuel est enregistré comme `Origin`. L'instantané d'origine n'est pas écrasé par les modifications ultérieures.

Lorsque vous cliquez sur `Save`, le worldbook actif dans SillyTavern est mis à jour immédiatement. Si le résultat ne vous convient pas, utilisez la barre latérale d'historique pour restaurer `Origin`, la base ou le résultat d'une expérience, ou une autre version enregistrée.

## Recherche, remplacement et suppression

Le Workbench peut rechercher des mots-clés exacts dans les champs pris en charge des entrées. Il peut :

- passer à l'occurrence précédente ou suivante
- sélectionner le texte correspondant sur place
- remplacer l'occurrence actuelle
- remplacer toutes les occurrences
- supprimer l'occurrence actuelle
- supprimer toutes les occurrences après confirmation

Les modifications liées à la recherche sont ajoutées à la pile d'annulation locale.

## Copier des entrées entre worldbooks

Dans l'onglet `Edit`, sélectionnez une ou plusieurs entrées avec les cases à cocher de la liste, puis cliquez sur `Copy to...`.

Les entrées copiées conservent leur contenu, leurs clés, leur position d'insertion, leur rôle, leur profondeur, leur ordre, leurs options, leur probabilité, leurs groupes, leurs déclencheurs, leurs filtres, leurs sources de correspondance et les autres paramètres pris en charge. De nouveaux UID sont générés dans le worldbook cible, afin de ne pas écraser les entrées existantes.

Le worldbook cible reçoit automatiquement des instantanés avant et après la copie, ce qui permet de le restaurer si la copie ne correspond pas à ce que vous vouliez.

## Presets MVU InitVar

L'onglet `MVU InitVar` analyse le `first_mes`, les `alternate_greetings` de la carte de personnage actuelle, ainsi que les swipes d'ouverture du chat actuel. Vous pouvez créer des presets InitVar, associer chaque ouverture à un preset et synchroniser le preset sélectionné dans l'entrée désactivée `[initvar]变量初始化勿开` pour les tests locaux côté auteur.

Pour les tests côté auteur, `Auto inject at opening` peut être activé tant qu'un nouveau chat est encore au message d'ouverture. Lorsque vous passez à une ouverture associée, le Workbench écrit uniquement le preset correspondant dans l'entrée de worldbook désactivée `[initvar]变量初始化勿开` et crée des instantanés avant/après dans l'historique. Si le bundle MVU expose déjà `window.Mvu`, le Workbench demande aussi à MVU de recharger les données InitVar dans le swipe d'ouverture actuel, afin que les auteurs puissent tester l'ouverture sélectionnée sans envoyer de message.

Pour les cartes partageables, utilisez `Copy player script` une fois vos presets et associations d'ouverture prêts. Cette action copie un script de personnage autonome JS-Slash-Runner/Tavern Helper avec la table des presets intégrée. Collez-le dans la bibliothèque de scripts de personnage afin qu'il soit exporté avec la carte. Côté joueur, le script ne s'exécute qu'au message d'ouverture, surveille le swipe sélectionné, maintient l'entrée désactivée `[initvar]变量初始化勿开` dans le worldbook du personnage actuel et demande à MVU de recharger le preset sélectionné dans le swipe d'ouverture actuel.

Ce flux de travail ne conserve qu'une seule entrée de worldbook visible et désactivée : `[initvar]变量初始化勿开`. Les presets et la table des ouvertures sont stockés dans les métadonnées d'extension de cette entrée, de sorte que les éditeurs de worldbook ordinaires n'affichent pas d'entrées supplémentaires `[MVU_INIT_PRESET:...]` ou `[MVU_INIT_MAP]`. Les anciennes données du Workbench utilisant ces entrées sont migrées vers les métadonnées `[initvar]` la prochaine fois que le worldbook est enregistré depuis le Workbench. Le Workbench reste un outil côté auteur ; le script de personnage copié est le runtime facultatif côté joueur.

## Expériences

Les expériences sont destinées aux changements petits et vérifiables.

`Start` capture la base. `Save` ou `Finish` capture la version après modification. Chaque expérience peut avoir :

- un nom
- une note
- un instantané de base
- un instantané après modification
- un statut conserver/rejeter

Les noms et notes d'expérience peuvent être recherchés dans la barre latérale d'historique.

## Exportation

Vous pouvez exporter :

- une seule expérience en JSON
- une seule version enregistrée en JSON
- tout l'historique local du worldbook sélectionné

Cela peut être utile pour organiser des dossiers de création ou partager une révision précise.

## Stockage et confidentialité

Lorsque le plugin serveur associé est disponible, les instantanés et les expériences sont stockés sous forme de fichiers JSON dans le dossier de sauvegarde utilisateur de SillyTavern :

```text
backups/worldbook-backup-helper/<worldbook>/
```

Lorsque le stockage serveur par fichiers est disponible, l'historique IndexedDB existant du navigateur est copié automatiquement dans ce dossier. L'ancienne copie du navigateur est conservée comme solution de repli.

En mode extension seule, les instantanés et les expériences restent stockés localement dans l'IndexedDB du navigateur, pour le profil SillyTavern actuel.

L'extension lit et écrit les worldbooks via l'API worldbook de SillyTavern. L'onglet `MVU InitVar` lit également les salutations de personnage présentes dans la page et les swipes d'ouverture du chat actuel pour associer les presets. Elle ne lit pas les cookies, les clés d'API, les profils de navigateur ni les fichiers locaux sans rapport.

## Compatibilité

Conçu et testé avec le code source public de SillyTavern `1.17.0`.

Le projet utilise le format standard des extensions tierces de SillyTavern, avec un fichier `manifest.json` à la racine.

TauriTavern est pris en charge avec le même lien de dépôt. L'extension détecte l'hôte TauriTavern et marque le Workbench comme surface plein écran mobile/bureau, afin que le panneau respecte le viewport et les zones de sécurité de TauriTavern.

## Limites connues

- L'historique en mode extension seule est local au navigateur. Si les données du navigateur sont supprimées avant la migration vers le stockage serveur ou avant une exportation manuelle, l'historique local peut être perdu.
- L'importation d'archives d'expériences externes n'est pas encore implémentée.
- L'extension se concentre sur les worldbooks/lorebooks, pas sur la modification de la description des cartes de personnage.

## Licence

Licence MIT. Voir [LICENSE](LICENSE).
