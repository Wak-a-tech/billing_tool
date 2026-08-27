# Générateur de factures

Outil **local** avec interface web pour générer des factures PDF.
Tout se passe dans le navigateur : **aucune donnée n'est envoyée sur Internet**,
aucun compte, aucun serveur distant. Les factures sont produites sur votre poste
et téléchargées dans votre dossier *Téléchargements*.

> 📄 Voir **[INSTALLATION.md](INSTALLATION.md)** pour le pas‑à‑pas d'installation
> (Mac et Windows), y compris pour les personnes non techniques.

---

## Fonctionnalités

- Numéro de facture automatique : `Facture n°<PRÉFIXE>-AAAA-xxxx`
  (préfixe et compteur réglables dans **Paramètres**, incrément à chaque génération).
- Logo de l'entreprise (PNG, JPG, WEBP, GIF, SVG — converti automatiquement).
- Dates d'émission (aujourd'hui par défaut) et d'échéance (+1 mois par défaut).
- Coordonnées de l'entreprise émettrice et de l'entreprise facturée,
  **enregistrables** pour être resélectionnées ensuite.
- Case « TVA non applicable » (mention *art. 293 B du CGI* sur le PDF).
- Devise (Euro par défaut, + USD / GBP / CHF).
- Lignes de facturation : description, quantité, prix unitaire, taux de TVA
  (20 / 10 / 5,5 / 2,1 %), avec calcul en direct des totaux HT / TVA / TTC.
- **Prévisualiser** (PDF à l'écran) et **Générer** (téléchargement du PDF).

## Démarrage rapide

1. Télécharger le projet (bouton vert **Code → Download ZIP** sur GitHub, puis
   décompresser) ou `git clone`.
2. Ouvrir un terminal dans le dossier et lancer un petit serveur local :

   ```bash
   # macOS / Linux
   python3 -m http.server 4173
   ```

   ```powershell
   # Windows (PowerShell)
   py -m http.server 4173
   ```

3. Ouvrir **http://localhost:4173** dans le navigateur.

Détails, alternatives (Node, VS Code) et dépannage : **[INSTALLATION.md](INSTALLATION.md)**.

## Où sont stockées les données ?

Les entreprises enregistrées, le logo et les réglages sont conservés dans le
**`localStorage` du navigateur**, uniquement sur votre machine.

- Rien n'est écrit dans le dépôt, rien n'est envoyé sur le réseau.
- Les données sont liées **au navigateur et au poste** utilisés : elles ne
  suivent pas si vous changez de navigateur ou d'ordinateur, et disparaissent si
  vous videz les données du site.
- Les PDF générés vont dans votre dossier *Téléchargements*.

Pour tout réinitialiser, coller ceci dans la console du navigateur (F12) :

```js
Object.keys(localStorage).filter(k => k.startsWith('bt.')).forEach(k => localStorage.removeItem(k))
```

## Téléchargements multiples (Chrome / Edge)

À la **2ᵉ** facture générée dans une session, le navigateur peut afficher
« le site souhaite télécharger plusieurs fichiers » : cliquer **Autoriser** une
fois (mémorisé ensuite). Si un téléchargement ne part pas, un lien
« *Le téléchargement n'a pas démarré ? Ouvrir …* » apparaît sous le formulaire et
ouvre le PDF dans un onglet (⌘S / Ctrl+S pour l'enregistrer).

## Structure du projet

```
billing_tool/
├── index.html          structure de la page
├── css/style.css        fond quadrillé + boutons « liquid glass »
├── js/app.js            logique : stockage, calculs, génération PDF
├── vendor/
│   ├── pdfmake.min.js   génération PDF (embarqué, hors ligne)
│   └── vfs_fonts.js     polices du PDF
├── INSTALLATION.md      guide d'installation Mac / Windows
├── LICENSE              licence MIT + composants tiers
└── README.md
```

Aucune étape de *build*, aucune dépendance à installer : ce sont des fichiers
statiques.

## Personnaliser

| Quoi | Où |
|---|---|
| Préfixe de numérotation (`WAK`, `ACME`, …) | bouton **Paramètres** dans l'appli |
| Prochain numéro de séquence | bouton **Paramètres** dans l'appli |
| Devises proposées | `js/app.js`, objet `DEVISES` |
| Taux de TVA proposés | `js/app.js`, tableau `TVA_RATES` |
| Couleurs / fond quadrillé | `css/style.css`, variables `:root` |

## Licence

MIT — voir [LICENSE](LICENSE). Inclut pdfmake (MIT) et la police Roboto
(Apache‑2.0).

Cet outil aide à produire des factures mais ne constitue pas un conseil
juridique ou comptable : il vous appartient de vérifier la conformité des
mentions obligatoires avec votre situation.
