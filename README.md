from pathlib import Path

readme = r'''<div align="center">

# Slay the Choir

**A roguelike rhythm battler where every run becomes a performance.**

[Play Demo](#) · [Devpost](#) · [Watch Demo](#)

</div>

<br>

<!-- HERO PLACEHOLDER
Replace the table below later with:

<p align="center">
  <img src="./docs/readme/hero.gif" width="100%" alt="Slay the Choir gameplay">
</p>
-->

<table width="100%">
  <tr>
    <td align="center">
      <br><br><br><br>
      <strong>HERO GIF</strong><br>
      <sub>1400 × 788 recommended</sub>
      <br><br><br><br>
    </td>
  </tr>
</table>

<br>

<div align="center">

Slay the Choir is a roguelike rhythm battler that fuses deckbuilding with music.
Build your choir, compose powerful combos, and battle through each run.

</div>

<br>

<table>
  <tr>
    <td width="33%" align="center">
      <h3>Build Your Choir</h3>
      <sub>Recruit unique voices, each with their own style.</sub>
      <br><br><br>
      <strong>FEATURE VISUAL 01</strong>
      <br><br><br>
    </td>
    <td width="33%" align="center">
      <h3>Battle Through Each Run</h3>
      <sub>Every encounter is a new arrangement.</sub>
      <br><br><br>
      <strong>FEATURE VISUAL 02</strong>
      <br><br><br>
    </td>
    <td width="33%" align="center">
      <h3>Turn Strategy Into Performance</h3>
      <sub>Time your plays and build the perfect performance.</sub>
      <br><br><br>
      <strong>FEATURE VISUAL 03</strong>
      <br><br><br>
    </td>
  </tr>
</table>

<br>

<table>
  <tr>
    <td width="50%" valign="top">

## Run it locally

```bash
git clone https://github.com/YOUR-ORG/slay-the-choir.git
cd slay-the-choir

npm install
npm run dev
```

    </td>
    <td width="50%" valign="top">

## Built with

- React
- TypeScript
- Vite
- Tailwind CSS
- Howler.js
- Node.js

    </td>
  </tr>
</table>

<br>

## Architecture

<!-- Replace this code block with a full-width architecture image later. -->

```text
Client
  ↓
Game Engine
  ↓
Audio System
  ↓
Assets / Data
```

<br>

## Meet the Team

<table>
  <tr>
    <td width="33%" align="center">
      <strong>Your Name</strong><br>
      <sub>Project Lead</sub><br><br>
      Game Design · Full Stack
    </td>
    <td width="33%" align="center">
      <strong>Teammate</strong><br>
      <sub>Art & Design</sub><br><br>
      Art Direction · UI/UX
    </td>
    <td width="33%" align="center">
      <strong>Teammate</strong><br>
      <sub>Gameplay & Systems</sub><br><br>
      Combat Systems · Audio
    </td>
  </tr>
</table>

<br>

---

<div align="center">

## Every voice matters.

**Slay the Choir.**

[★ Star this repository](#)

</div>
'''

path = Path("/mnt/data/README.md")
path.write_text(readme, encoding="utf-8")
print(f"Created {path}")
