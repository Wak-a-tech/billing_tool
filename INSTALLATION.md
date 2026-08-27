# Installation

Ce guide explique comment faire fonctionner l'outil sur **macOS** et **Windows**,
étape par étape. Aucune connaissance technique n'est requise.

L'outil est composé de simples fichiers (HTML / CSS / JS). Il n'y a **rien à
compiler ni à installer** en tant que logiciel : il suffit de servir le dossier
avec un petit serveur web local, puis de l'ouvrir dans un navigateur.

---

## 1. Récupérer le projet

### Option A — Télécharger le ZIP (le plus simple)

1. Sur la page GitHub du projet, cliquer sur le bouton vert **`< > Code`**.
2. Choisir **Download ZIP**.
3. Décompresser l'archive :
   - **macOS** : double‑cliquer sur le fichier `.zip` dans le dossier
     *Téléchargements*.
   - **Windows** : clic droit sur le `.zip` → **Extraire tout…**.
4. Vous obtenez un dossier `billing_tool` (ou `billing_tool-main`).

### Option B — Avec Git

```bash
git clone https://github.com/<votre-compte>/billing_tool.git
cd billing_tool
```

---

## 2. Lancer l'outil

Le navigateur doit charger la page via une adresse `http://localhost:…`
(et non en double‑cliquant sur `index.html`, ce qui empêche certaines
fonctions de marcher selon le navigateur).

Choisissez **une** des méthodes ci‑dessous.

### Méthode 1 — Python (recommandée, rien à installer sur Mac)

#### macOS

1. Ouvrir l'app **Terminal** (⌘+Espace, taper « Terminal », Entrée).
2. Se placer dans le dossier du projet — taper `cd ` (avec l'espace) puis
   **glisser‑déposer le dossier** `billing_tool` dans la fenêtre du Terminal, et
   Entrée. Exemple :
   ```bash
   cd ~/Downloads/billing_tool
   ```
3. Lancer le serveur :
   ```bash
   python3 -m http.server 4173
   ```
   > Si macOS propose d'installer les « outils de développement en ligne de
   > commande », accepter (une fois), puis relancer la commande.
4. Laisser cette fenêtre ouverte. Ouvrir le navigateur sur :
   **http://localhost:4173**
5. Pour arrêter : revenir au Terminal et faire **Ctrl + C**.

#### Windows

1. Installer Python si besoin :
   - **Microsoft Store** → rechercher **Python 3** → *Obtenir* ; **ou**
   - <https://www.python.org/downloads/> → cocher **« Add python.exe to PATH »**
     pendant l'installation.
2. Ouvrir **PowerShell** (menu Démarrer → taper « PowerShell »).
3. Se placer dans le dossier :
   ```powershell
   cd $HOME\Downloads\billing_tool
   ```
4. Lancer le serveur :
   ```powershell
   py -m http.server 4173
   ```
   > Si `py` n'est pas reconnu, essayer `python -m http.server 4173`.
   > Autoriser l'accès si le pare‑feu Windows le demande.
5. Ouvrir le navigateur sur **http://localhost:4173**
6. Pour arrêter : **Ctrl + C** dans PowerShell.

### Méthode 2 — Node.js

Valable sur Mac et Windows, si Node.js est installé (<https://nodejs.org>).

```bash
cd billing_tool
npx serve . -l 4173
```

Puis ouvrir l'adresse affichée (par ex. `http://localhost:4173`).

### Méthode 3 — Visual Studio Code (interface graphique)

1. Installer **VS Code** : <https://code.visualstudio.com>
2. Dans VS Code : onglet **Extensions** → installer **Live Server**
   (éditeur : Ritwick Dey).
3. **Fichier → Ouvrir le dossier…** → choisir `billing_tool`.
4. Clic droit sur `index.html` → **Open with Live Server**.
   Le navigateur s'ouvre automatiquement.

---

## 3. Première utilisation

1. Cliquer sur **Paramètres** (en haut à droite) et régler :
   - le **préfixe de numérotation** (ex. `WAK`, `ACME`, vos initiales…) ;
   - le **prochain numéro de séquence** (ex. `1`).
2. Choisir le **logo** (facultatif) — il est mémorisé pour les prochaines fois.
3. Renseigner l'**entreprise qui facture**, puis cliquer **Enregistrer** :
   elle apparaîtra ensuite dans la liste déroulante.
4. Idem pour l'**entreprise à facturer**.
5. Ajouter les **lignes** de la facture.
6. **Prévisualiser** pour vérifier, puis **Générer** pour télécharger le PDF.

Les données saisies (entreprises, logo, réglages) restent sur votre poste, dans
le navigateur utilisé.

---

## 4. Dépannage

| Problème | Solution |
|---|---|
| `python3: command not found` (Mac) | Accepter l'installation des *Command Line Tools* proposée, ou installer Python via <https://www.python.org/downloads/>. |
| `py`/`python` non reconnu (Windows) | Réinstaller Python en cochant **« Add to PATH »**, rouvrir PowerShell. |
| La page reste blanche | Vérifier que l'adresse est bien `http://localhost:4173` et que la fenêtre du serveur est toujours ouverte. |
| Port déjà utilisé | Remplacer `4173` par un autre nombre (ex. `8080`) dans la commande **et** dans l'URL. |
| Le PDF ne se télécharge pas (2ᵉ fois) | Cliquer **Autoriser** sur la demande « télécharger plusieurs fichiers », ou utiliser le lien de secours affiché sous le formulaire. |
| Le logo ne s'affiche pas dans le PDF | Réessayer avec un PNG ou un JPG ; les très grands fichiers sont réduits automatiquement. |
| Rien ne se sauvegarde | Le navigateur est peut‑être en navigation privée, ou le `localStorage` est bloqué pour le site. |

---

## 5. Mettre à jour

Retélécharger le ZIP (ou `git pull`) et remplacer les fichiers. Les données
étant dans le navigateur, elles ne sont pas affectées par la mise à jour.
