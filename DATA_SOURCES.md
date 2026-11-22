# Data sources

- Real astronomical objects: compiled from memory of published catalogues (NASA, NASA Exoplanet Archive, SIMBAD, NED, ESA) with a `source` and `references` on every object. **Not re-verified against live archives**; `last_verified` is `null`. Unknown values read DATA UNKNOWN.
- Everything else is simulated game data: Meridian Station, crew, Earth agencies and panels, missions, events and transient alerts ("Simulated event"), technologies and station modules.
- Transient alerts never name real objects and are never presented as real measurements.
