# Générateur de factures

Outil web de génération de factures PDF, partagé entre associés.
En ligne sur **https://wak-factures.pages.dev**, protégé par Cloudflare Access
(connexion par code reçu par email, réservée aux adresses autorisées).

Les PDF sont produits dans le navigateur. Le serveur conserve uniquement les
données partagées : compteur de factures, entreprises enregistrées, logo,
préfixe et historique des factures.

> 📄 Déploiement, administration et développement local :
> **[INSTALLATION.md](INSTALLATION.md)**.

---

## Fonctionnalités

- Numéro de facture automatique : `Facture n°<PRÉFIXE>-AAAA-xxxx`
  (préfixe et compteur partagés, réglables dans **Paramètres**).
- Logo de l'entreprise (PNG, JPG, WEBP, GIF, SVG — converti automatiquement).
- Dates d'émission (aujourd'hui par défaut) et d'échéance (+1 mois par défaut).
- Coordonnées de l'entreprise émettrice et de l'entreprise facturée,
  **enregistrables** pour être resélectionnées ensuite.
- Case « TVA non applicable » (mention *art. 293 B du CGI* sur le PDF).
- Devise (Euro par défaut, + USD / GBP / CHF).
- Lignes de facturation : description, quantité, prix unitaire, taux de TVA
  (20 / 10 / 5,5 / 2,1 %), avec calcul en direct des totaux HT / TVA / TTC.
- **Prévisualiser** (PDF à l'écran) et **Générer** (téléchargement du PDF).
- **Numérotation partagée** : le numéro est attribué par le serveur au clic sur
  *Générer*. Deux personnes ne peuvent jamais obtenir le même numéro, et il n'y
  a pas de trou dans la séquence.
- **Historique** des factures émises (numéro, date, client, montant, auteur),
  avec re‑téléchargement du PDF à l'identique.

## Où sont stockées les données ?

| Donnée | Emplacement |
|---|---|
| Compteur, préfixe, logo, entreprises enregistrées, historique | Base Cloudflare D1 `wak-factures`, partagée |
| Devise, case TVA, dernières entreprises sélectionnées | `localStorage` de chaque navigateur |
| PDF générés | Dossier *Téléchargements* (re‑générables depuis l'historique) |

Les factures émises ne sont jamais supprimées. Pour annuler une facture, émettez
un avoir.

## Téléchargements multiples (Chrome / Edge)

À la **2ᵉ** facture générée dans une session, le navigateur peut afficher
« le site souhaite télécharger plusieurs fichiers » : cliquer **Autoriser** une
fois (mémorisé ensuite). Si un téléchargement ne part pas, un lien
« *Le téléchargement n'a pas démarré ? Ouvrir …* » apparaît sous le formulaire et
ouvre le PDF dans un onglet (⌘S / Ctrl+S pour l'enregistrer).

## Structure du projet

```
billing_tool/
├── public/                  site statique (servi tel quel)
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js            interface, calculs, génération PDF, appels API
│   └── vendor/              pdfmake + polices
├── functions/api/
│   ├── _middleware.js       vérification Cloudflare Access + liste d'emails
│   └── [[path]].js          API : état, entreprises, compteur, factures
├── migrations/              schéma de la base D1
├── wrangler.toml            configuration Cloudflare
└── INSTALLATION.md          déploiement et administration
```

## Personnaliser

| Quoi | Où |
|---|---|
| Préfixe de numérotation (`WAK`, `ACME`, …) | bouton **Paramètres** dans l'appli (partagé) |
| Prochain numéro de séquence | bouton **Paramètres** dans l'appli |
| Devises proposées | `public/js/app.js`, objet `DEVISES` |
| Taux de TVA proposés | `public/js/app.js`, tableau `TVA_RATES` |
| Personnes autorisées | `ALLOWED_EMAILS` dans `wrangler.toml` **et** la policy Cloudflare Access |
| Couleurs / fond quadrillé | `public/css/style.css`, variables `:root` |

## Licence

MIT — voir [LICENSE](LICENSE). Inclut pdfmake (MIT) et la police Roboto
(Apache‑2.0).

Cet outil aide à produire des factures mais ne constitue pas un conseil
juridique ou comptable : il vous appartient de vérifier la conformité des
mentions obligatoires avec votre situation.
