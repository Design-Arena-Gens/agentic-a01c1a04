import {
  DynamicPropertiesDefinition,
  EntityTypes,
  MinecraftEffectTypes,
  Player,
  system,
  world
} from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { MORPHS } from "./morphs.js";
import {
  abilityHandlers,
  PROP_AVATAR_ID,
  PROP_MORPH_ID,
  PROP_STATE,
  serializeState
} from "./abilities.js";

const activeMorphs = new Map();
const avatarOwners = new Map();

world.afterEvents.worldInitialize.subscribe(({ propertyRegistry }) => {
  const definition = new DynamicPropertiesDefinition();
  definition.defineString(PROP_MORPH_ID, 32);
  definition.defineString(PROP_AVATAR_ID, 48);
  definition.defineString(PROP_STATE, 4096);
  propertyRegistry.registerEntityTypeDynamicProperties(definition, EntityTypes.get("minecraft:player"));
});

world.afterEvents.itemUse.subscribe((event) => {
  const { itemStack, source } = event;
  if (!(source instanceof Player)) return;
  if (!itemStack || itemStack.typeId !== "minecraft:clock") return;
  openMorphMenu(source);
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const record = activeMorphs.get(playerId);
  if (!record) return;
  const player = world.getPlayers().find((p) => p.id === playerId);
  if (player) {
    removeMorph(player, "player_left");
  } else {
    cleanupAvatar(record.avatarId);
    activeMorphs.delete(playerId);
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  const ownerId = avatarOwners.get(deadEntity.id);
  if (!ownerId) return;
  const owner = world.getPlayers().find((player) => player.id === ownerId);
  if (owner) {
    removeMorph(owner, "avatar_died");
  }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  removeMorph(player, "respawn");
});

world.afterEvents.entityHitEntity.subscribe((event) => {
  const player = event.damagingEntity;
  if (!(player instanceof Player)) return;
  const record = activeMorphs.get(player.id);
  if (!record) return;
  const handler = abilityHandlers[record.morphId];
  if (handler?.onEntityHit) {
    const avatar = world.getEntity(record.avatarId);
    handler.onEntityHit(
      {
        player,
        avatar,
        morphId: record.morphId,
        state: record.state
      },
      event
    );
  }
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const record = activeMorphs.get(player.id);
    if (!record) continue;
    const { morphId } = record;
    const handler = abilityHandlers[morphId];
    if (!handler) continue;

    let avatar = world.getEntity(record.avatarId);
    if (!avatar) {
      avatar = respawnAvatar(player, record);
      if (!avatar) {
        removeMorph(player, "avatar_missing");
        continue;
      }
    }

    const updatedState = handler.tick?.({
      player,
      avatar,
      state: record.state,
      morphId,
      removeMorph: (reason) => removeMorph(player, reason)
    });
    if (updatedState !== undefined) {
      record.state = updatedState;
    }
    player.setDynamicProperty(PROP_STATE, serializeState(record.state));
  }
}, 1);

function openMorphMenu(player) {
  const form = new ModalFormData();
  form.title("Morph Selector");
  for (const morph of MORPHS) {
    form.button(`${morph.displayName}\n${morph.description}`);
  }

  form
    .show(player)
    .then((response) => {
      if (response.canceled) return;
      const selection = MORPHS[response.selection];
      if (!selection) return;
      applyMorph(player, selection);
    })
    .catch((error) => {
      console.warn(`[morph] Failed to display morph menu: ${error}`);
    });
}

function applyMorph(player, morphDefinition) {
  if (!morphDefinition) return;
  removeMorph(player, "replacing");

  const spawnLocation = offsetAbove(player.location, 0.1);
  let avatar;
  try {
    avatar = player.dimension.spawnEntity(morphDefinition.avatarEntity, spawnLocation);
  } catch (error) {
    console.warn(`[morph] Unable to spawn avatar entity (${morphDefinition.id}): ${error}`);
    return;
  }

  if (!avatar) {
    console.warn("[morph] Avatar spawn returned undefined.");
    return;
  }

  avatar.addTag("morph_avatar");
  avatarOwners.set(avatar.id, player.id);
  avatar.addRider(player);

  const handler = abilityHandlers[morphDefinition.ability];
  const state = handler?.init
    ? handler.init({
        player,
        avatar,
        morphId: morphDefinition.id
      }) ?? {}
    : {};

  player.addEffect(MinecraftEffectTypes.invisibility, 2000000000, { amplifier: 1, showParticles: false });

  const record = {
    morphId: morphDefinition.ability,
    avatarId: avatar.id,
    state
  };

  activeMorphs.set(player.id, record);
  player.setDynamicProperty(PROP_MORPH_ID, morphDefinition.ability);
  player.setDynamicProperty(PROP_AVATAR_ID, avatar.id);
  player.setDynamicProperty(PROP_STATE, serializeState(state));
}

function removeMorph(player, reason) {
  const record = activeMorphs.get(player.id);
  if (!record) {
    clearDynamicProperties(player);
    player.removeEffect(MinecraftEffectTypes.invisibility);
    return;
  }

  const handler = abilityHandlers[record.morphId];
  if (handler?.cleanup) {
    try {
      handler.cleanup({
        player,
        morphId: record.morphId,
        state: record.state
      });
    } catch (error) {
      console.warn(`[morph] Cleanup error for ${record.morphId}: ${error}`);
    }
  }

  cleanupAvatar(record.avatarId);

  player.removeEffect(MinecraftEffectTypes.invisibility);
  clearDynamicProperties(player);
  activeMorphs.delete(player.id);
}

function respawnAvatar(player, record) {
  const morphDefinition = MORPHS.find((entry) => entry.ability === record.morphId);
  if (!morphDefinition) return undefined;
  try {
    const newAvatar = player.dimension.spawnEntity(morphDefinition.avatarEntity, offsetAbove(player.location, 0.25));
    if (!newAvatar) return undefined;
    newAvatar.addTag("morph_avatar");
    avatarOwners.set(newAvatar.id, player.id);
    newAvatar.addRider(player);
    record.avatarId = newAvatar.id;
    player.setDynamicProperty(PROP_AVATAR_ID, newAvatar.id);
    return newAvatar;
  } catch (error) {
    console.warn(`[morph] Failed to respawn avatar: ${error}`);
    return undefined;
  }
}

function cleanupAvatar(avatarId) {
  if (!avatarId) return;
  const avatar = world.getEntity(avatarId);
  avatarOwners.delete(avatarId);
  if (!avatar) return;
  try {
    avatar.kill();
  } catch {
    try {
      avatar.remove();
    } catch {
      // ignore removal errors
    }
  }
}

function clearDynamicProperties(player) {
  player.setDynamicProperty(PROP_MORPH_ID, undefined);
  player.setDynamicProperty(PROP_AVATAR_ID, undefined);
  player.setDynamicProperty(PROP_STATE, undefined);
}

function offsetAbove(location, yOffset) {
  return {
    x: location.x,
    y: location.y + (yOffset ?? 0),
    z: location.z
  };
}
