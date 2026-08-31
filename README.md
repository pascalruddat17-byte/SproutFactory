# Sproutworks

Ein erster 2D-Top-down-Prototyp fuer ein cozy Factory-Game mit freier Flugkamera, grosser Naturkarte und kachelbasiertem Bauen.

## Starten

Oeffne `index.html` in einem Browser.

## Steuerung

- PC: Kamera mit WASD oder Pfeiltasten bewegen, mit dem Mausrad zoomen
- Handy-Modus: Im Menue auf Handy umschalten, mit einem Finger wischen und mit zwei Fingern zoomen
- Ressourcenleiste oben: Coin, Stein, Eisen und Holz
- Lager anklicken: Upgrade-Fenster mit benoetigten Ressourcen anzeigen
- Baumenue unten rechts: Kategorien Factories, Transportmittel, Deko und Lager
- Bagger neben dem Baumenue: gebautes Teil anklicken, um es zu loeschen und die halben Materialien zurueckzubekommen
- Move neben dem Baumenue: gebautes Teil auswaehlen, mit `R` oder dem unteren Button drehen und an eine neue gueltige Kachel verschieben
- Die Fabrik wird automatisch im Browser gespeichert und beim naechsten Oeffnen wieder geladen
- Factories: Holzfabrik als 2x2-Gebaeude bauen und mit Foerderbaendern verbinden
- Factories: Steinfabrik als 2x2-Gebaeude in Felsnaehe bauen; sie produziert Stein-Items
- Transportmittel: gerade Foerderbaender, Eckfoerderbaender, Zusammenfuehrer und 3-Wege-Splitter, jeweils eine Kachel gross
- Beim Bauen mit `R` oder dem unteren Button drehen und mit `Escape` oder `Abbrechen` stoppen
- Der Zusammenfuehrer verbindet alle drei T-Seiten miteinander
- Der Splitter verbindet alle vier Seiten und kann eine Linie in drei Richtungen aufteilen
- Holz sucht bei jeder erreichten Foerderband-Kachel neu den naechsten Weg und folgt dabei der Foerderband-Richtung; ohne passendes Band oder Lageranschluss wird es am Bandende geloescht
- Wird ein Foerderband geloescht, verschwinden Items, die gerade dorthin fahren oder direkt davon abhaengen
- Der Lagereingang sitzt links am Lager und nimmt Holz an, wenn ein Band dort endet

## Struktur

- `src/config.js`: zentrale Werte fuer Welt, Kamera, Ressourcen, Kosten und Maschinen
- `src/state.js`: aktueller Spielzustand mit Ressourcen, Maschinen und Baumodus
- `src/machines.js`: Holzfabrik, Foerderbaender, Kachelplatzierung, Verbindung und Produktion
- `src/game.js`: Canvas, Loop, freie Flugkamera und Render-Reihenfolge
- `src/world.js`: Naturwelt, Hindernisse und Kollisionsdaten
- `src/ui.js`: Shop, Menue und Steuerungsmodus

Die Struktur ist absichtlich klein gehalten, damit spaeter Maschinen, Foerderbaender,
Ressourcen und Upgrades als eigene Module ergaenzt werden koennen.
