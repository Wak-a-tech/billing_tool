# Installation, déploiement et administration

L'outil tourne sur **Cloudflare Pages** (site + API) avec une base **D1**, et
l'accès est filtré par **Cloudflare Access**. Tout tient dans l'offre gratuite.

- Site : https://wak-factures.pages.dev
- Projet Pages : `wak-factures`
- Base D1 : `wak-factures`

---

## 1. Utilisation au quotidien

1. Ouvrir **https://wak-factures.pages.dev**.
2. Saisir son email autorisé, puis le code reçu par email (Cloudflare Access).
3. Remplir la facture, puis cliquer sur **Générer**. Le numéro définitif est
   attribué à ce moment‑là. Si l'associé vient de générer une facture, on
   obtient automatiquement le numéro suivant.
4. **Historique** liste toutes les factures émises. Le bouton **PDF** re‑télécharge
   une facture à l'identique (avec le logo actuel).

Le numéro affiché en haut du formulaire est le prochain numéro libre. Il se met
à jour quand on revient sur l'onglet.

---

## 2. Reprendre les données de l'ancienne version locale

L'ancienne version stockait les entreprises et le logo dans le navigateur, sur
`http://localhost:4173`. Pour les transférer :

1. Relancer l'ancienne version (`python3 -m http.server 4173` dans l'ancien
   dossier), l'ouvrir dans le **même navigateur** que d'habitude.
2. Ouvrir la console (F12 → *Console*), coller puis valider :

   ```js
   (() => {
     const g = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
     const data = { issuers: g('bt.issuers', []), clients: g('bt.clients', []), logo: g('bt.logo', null), seq: g('bt.seq', 1) };
     const a = document.createElement('a');
     a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
     a.download = 'factures-export.json';
     a.click();
     console.log('Prochain numéro local :', data.seq);
   })();
   ```

3. Sur le site en ligne : **Paramètres → Importer des données locales (.json)…**
   et choisir `factures-export.json`. Chaque associé peut importer son fichier :
   les entreprises sont fusionnées, rien n'est écrasé chez l'autre.
4. **Compteur** : dans **Paramètres**, saisir comme *prochain numéro* le plus
   grand des deux numéros locaux affichés dans la console. Le compteur ne
   peut jamais redescendre sous une facture déjà émise.

---

## 3. Gérer les personnes autorisées

Deux endroits, à garder identiques :

1. **Cloudflare Access** (https://one.dash.cloudflare.com → Access →
   Applications → *Factures WAK* → Policies) : qui peut se connecter.
2. **`ALLOWED_EMAILS`** dans `wrangler.toml` : qui l'API accepte. C'est une
   seconde barrière, au cas où Access serait mal configuré. Redéployer après
   modification (voir §4).

---

## 4. Déployer une modification

Prérequis : Node.js, puis une fois `npm install` et `npx wrangler login`.

```bash
npm run deploy
```

Cette commande applique les éventuelles nouvelles migrations de base, puis
publie `public/` et `functions/`.

---

## 5. Développer en local

```bash
npm run dev
```

Puis ouvrir http://localhost:8788. La base locale (dans `.wrangler/`) est
séparée de la production. En local, Access est remplacé par l'email défini
dans `.dev.vars` (`DEV_USER_EMAIL=...`, fichier non versionné).

---

## 6. Sauvegarde

D1 conserve 30 jours d'historique restaurable (*Time Travel*). Pour un export
complet à garder de votre côté :

```bash
npx wrangler d1 export wak-factures --remote --output sauvegarde.sql
```

---

## 7. Configuration initiale (référence, déjà faite)

1. `npx wrangler d1 create wak-factures`, puis reporter l'identifiant dans
   `wrangler.toml`.
2. `npx wrangler pages project create wak-factures --production-branch main`
3. Zero Trust → Access → Applications → *Self‑hosted* sur
   `wak-factures.pages.dev` et `*.wak-factures.pages.dev`. Policy *Allow*
   avec les emails autorisés, connexion *One‑time PIN*.
4. Reporter `ACCESS_TEAM_DOMAIN` (`https://<équipe>.cloudflareaccess.com`) et
   `ACCESS_AUD` (*Application Audience Tag*) dans `wrangler.toml`.
5. `npm run deploy`

Sans `ACCESS_TEAM_DOMAIN` et `ACCESS_AUD`, l'API en ligne refuse toutes les
requêtes.
