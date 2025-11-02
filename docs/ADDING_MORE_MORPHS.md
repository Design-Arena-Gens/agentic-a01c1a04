# Extending the Morph Roster

This guide explains how to add new morph options to the Morph System add-on. The process revolves around four coordinated tasks:

1. Create a controllable avatar entity (behavior pack).
2. Provide client visuals (resource pack).
3. Register the morph in the scripted menu.
4. Implement custom ability hooks.

The examples below assume you are adding a **Blaze** morph. Swap names and identifiers for your own mob.

---

## 1. Behavior Pack – Avatar Entity

1. Duplicate one of the existing avatar files in `addon/behavior_pack/entities/`, e.g.:
   ```
   addon/behavior_pack/entities/blaze_avatar.entity.json
   ```
2. Update the `identifier` to `morph:blaze_avatar`.
3. Adjust components:
   - Set collision box and physics to match the mob’s shape.
   - Pick appropriate movement components (`minecraft:movement.fly`, `minecraft:can_fly`, etc.).
   - Keep `minecraft:rideable`, `minecraft:input_ground_controlled`, and `minecraft:movement.basic` so the player can steer.
4. Optional: add `minecraft:damage_sensor`, `minecraft:fire_immune`, or other relevant traits to mimic the mob.

> Tip: Use the vanilla behavior pack as a reference for component combinations the original mob uses.

---

## 2. Resource Pack – Client Entity

1. Create `addon/resource_pack/entity/blaze_avatar.entity.json` mirroring the pattern from the existing avatar entities.
2. Reference the vanilla assets whenever possible:
   ```json
   {
     "textures": { "default": "textures/entity/blaze" },
     "geometry": { "default": "geometry.blaze" },
     "animations": {
       "default": "animation.blaze.idle",
       "move": "animation.blaze.move"
     },
     "render_controllers": ["controller.render.morph_blaze"]
   }
   ```
3. Add a matching entry to `addon/resource_pack/render_controllers/morph_render_controllers.json`:
   ```json
   "controller.render.morph_blaze": {
     "geometry": "Geometry.default",
     "materials": [{ "*": "Material.default" }],
     "textures": ["Texture.default"]
   }
   ```
4. If you need custom textures or animations, place them in `addon/resource_pack/textures/` or `addon/resource_pack/animations/` and update the paths.

---

## 3. Script Registration

1. Append your morph to `addon/behavior_pack/scripts/morphs.js`:
   ```js
   {
     id: "blaze",
     displayName: "Blaze",
     description: "Hover and launch fireballs.",
     avatarEntity: "morph:blaze_avatar",
     ability: "blaze"
   }
   ```
2. The `id` field is used for UI display, while `ability` maps to the handler defined in the next step.

---

## 4. Ability Hooks

1. Open `addon/behavior_pack/scripts/abilities.js`.
2. Add a new entry to `abilityHandlers`:
   ```js
   blaze: {
     init({ player }) {
       player.addEffect(MinecraftEffectTypes.fireResistance, 2000000000, { amplifier: 1, showParticles: false });
       return { cooldown: 0 };
     },
     tick({ player, avatar, state, removeMorph }) {
       if (state.cooldown > 0) state.cooldown -= 1;
       // Custom logic goes here…
       return state;
     },
     cleanup({ player }) {
       player.removeEffect(MinecraftEffectTypes.fireResistance);
     }
   }
   ```
3. Use the `tick` hook for frame-by-frame logic (movement boosts, passive effects, cooldowns).
4. Use optional event hooks:
   - `onEntityHit(context, event)` – triggered when the morphed player lands melee hits.
   - Add new hooks as needed (e.g., expose block interaction events from `main.js`).

You can access:

- `context.player` – the real player entity.
- `context.avatar` – the rideable avatar entity (may be `undefined` if it was just removed).
- `context.removeMorph(reason)` – failsafe to revert if something goes wrong.

Persist state through the `state` object returned from `init`/`tick`. It is serialized to dynamic properties so it survives brief reloads.

---

## 5. Testing Checklist

- Load the pack with experimental toggles enabled.
- Use the clock menu and confirm the new morph appears with the right description.
- Morph into the new mob and verify:
  - Player invisibility + avatar rendering.
  - Movement speed, jump height, and physics feel correct.
  - Ability hooks fire as expected.
  - Remorphing cleans up spawned entities and effects.
- Test edge cases: death while morphed, dimension changes, multiplayer interactions.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Avatar stays in world after morph swap | Ensure `removeMorph` cleans up the avatar via `cleanupAvatar` (provided in `main.js`). |
| Player falls through world when mounting | Seat position may be too low/high; adjust `position` in `minecraft:rideable`. |
| Animations or textures missing | Double-check the texture/geometry keys or include missing assets in the resource pack. |
| Ability state reset every tick | Return the updated state from `tick` and avoid mutating the `state` object directly. |

---

## Advanced Ideas

- Add ranged abilities by spawning projectiles from the avatar (see `dimension.spawnEntity`).
- Build combo inputs (e.g., sprint + jump) by recording previous tick button states in `state`.
- Grant contextual buffs (fire immunity, underwater breathing) with long-duration effects refreshed in `tick`.
- Synchronize audio/particle feedback using `dimension.playSound` and `dimension.spawnParticle`.

By following this workflow you can expand the morph lineup without touching the core engine code, keeping maintenance simple while delivering custom-tailored abilities.
