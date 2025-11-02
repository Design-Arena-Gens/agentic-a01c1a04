# Morphic Horizons – Minecraft Bedrock Morph Add-On

This repository contains a full-featured Minecraft Bedrock Edition morph system. Players can open an interactive UI with a clock, pick a mob, and instantly morph into a fully controllable avatar that mimics the chosen mob’s appearance and signature abilities. The project ships with Creeper, Enderman, and Bee morphs plus a documented pipeline for adding any additional mob.

## Contents

- `addon/behavior_pack` – Gameplay logic, scripted menu system, ability handling, and custom avatar entity definitions.
- `addon/resource_pack` – Client entity definitions and render controllers that reuse vanilla mob animations and textures.
- `docs/ADDING_MORE_MORPHS.md` – Step-by-step guide for extending the morph roster safely.

## Installation

1. Zip the `addon` folder and rename the archive to `Morphs.mcaddon`.
2. Double-click the `.mcaddon` file (or import it on mobile) to add both packs to Minecraft Bedrock.
3. Create or edit a world with the following experimental toggles enabled:
   - **Beta APIs** (to allow GameTest scripting)
   - **Holiday Creator Features**
4. Activate both the **Morph System Behavior Pack** and **Morph System Resource Pack** for the world.
5. Join the world, equip a clock, and choose a morph from the menu.

## Development Notes

- The add-on relies on `@minecraft/server` and `@minecraft/server-ui`. Ensure the world is running a Bedrock version that supports these modules (1.20.60+ recommended).
- Avatar entities are controlled rideables that inherit mob geometry/animations through resource pack render controllers.
- Abilities are scripted in `addon/behavior_pack/scripts/abilities.js`. Each morph has `init`, `tick`, and optional `onEntityHit` hooks for custom logic.
- The morph menu and lifecycle are handled in `addon/behavior_pack/scripts/main.js`.

## Testing Checklist

- Confirm the morph menu opens when using a clock.
- Morph into each bundled mob and verify:
  - Player model becomes invisible and the avatar mirrors controls.
  - Ability triggers (creeper explosion crouch, enderman teleport, bee sting).
  - Removing or swapping morphs cleans up avatar entities.
- Validate multiplayer by having multiple players morph simultaneously.

## Extending the System

Use `docs/ADDING_MORE_MORPHS.md` as the authoritative reference. In summary:

1. Define a new avatar entity in the behavior pack.
2. Add a matching client entity definition and render controller entry.
3. Register the morph in `scripts/morphs.js`.
4. Implement abilities in `scripts/abilities.js`.

## Licensing

The pack references geometry and texture keys from the vanilla Bedrock resources. Ensure your distribution complies with Mojang’s add-on guidelines and only ships new or derivative assets that you have the rights to share.
