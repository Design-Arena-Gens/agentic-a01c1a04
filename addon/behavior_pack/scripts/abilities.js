import { MinecraftEffectTypes } from "@minecraft/server";

export const PROP_MORPH_ID = "morph:current_id";
export const PROP_AVATAR_ID = "morph:avatar_id";
export const PROP_STATE = "morph:ability_state";

const MAX_STATE_LENGTH = 4096;

export const abilityHandlers = {
  creeper: {
    init({ player }) {
      player.addEffect(MinecraftEffectTypes.fireResistance, 2000000000, { amplifier: 1, showParticles: false });
      return { chargeTicks: 0, charging: false };
    },
    tick(context) {
      const { player, avatar, state, removeMorph } = context;
      if (!player.isSneaking) {
        if (state.charging) {
          avatar.dimension.playSound("random.fuse", avatar.location, { pitch: 0.5 });
        }
        return { chargeTicks: 0, charging: false };
      }

      const updatedCharge = state.chargeTicks + 1;

      if (!state.charging) {
        avatar.dimension.playSound("random.fuse", avatar.location, { pitch: 1.1 });
      }

      if (updatedCharge >= 40) {
        avatar.dimension.createExplosion(avatar.location, 4, {
          breaksBlocks: true,
          causesFire: false,
          allowUnderwater: true,
          fireAffectedByGriefing: false
        });
        removeMorph("creeper_explosion");
        return { chargeTicks: 0, charging: false, exploded: true };
      }

      avatar.dimension.spawnParticle("minecraft:basic_flame_particle", avatar.location);

      return { chargeTicks: updatedCharge, charging: true };
    },
    cleanup({ player }) {
      player.removeEffect(MinecraftEffectTypes.fireResistance);
    }
  },
  enderman: {
    init({ player }) {
      player.addEffect(MinecraftEffectTypes.slowFalling, 2000000000, { amplifier: 0, showParticles: false });
      player.addEffect(MinecraftEffectTypes.nightVision, 2000000000, { amplifier: 0, showParticles: false });
      return { cooldown: 0, wasJumping: false };
    },
    tick(context) {
      const { player, avatar, state, removeMorph } = context;
      let { cooldown, wasJumping } = state;
      if (cooldown > 0) cooldown -= 1;

      const isCombo = player.isSneaking && player.isJumping;
      let nextState = { cooldown, wasJumping: player.isJumping };

      if (isCombo && !wasJumping && cooldown === 0) {
        const direction = player.getViewDirection();
        const maxDistance = 16;
        const origin = avatar.location;
        const destination = {
          x: origin.x + direction.x * maxDistance,
          y: Math.max(1, origin.y + direction.y * maxDistance),
          z: origin.z + direction.z * maxDistance
        };

        try {
          avatar.dimension.spawnParticle("minecraft:portal_particle", origin);
          player.teleport(destination, { rotation: player.rotation });
          avatar.teleport(destination, { dimension: avatar.dimension, rotation: avatar.rotation });
          avatar.dimension.spawnParticle("minecraft:portal_particle", destination);
          avatar.dimension.playSound("mob.endermen.portal", destination, { pitch: 1.0 });
          cooldown = 40;
          nextState = { cooldown, wasJumping: player.isJumping };
        } catch (error) {
          removeMorph("enderman_tp_failure");
        }
      }

      player.addEffect(MinecraftEffectTypes.slowFalling, 10, { amplifier: 0, showParticles: false });
      player.addEffect(MinecraftEffectTypes.resistance, 10, { amplifier: 1, showParticles: false });

      return nextState;
    },
    cleanup({ player }) {
      player.removeEffect(MinecraftEffectTypes.nightVision);
      player.removeEffect(MinecraftEffectTypes.slowFalling);
      player.removeEffect(MinecraftEffectTypes.resistance);
    }
  },
  bee: {
    init({ player }) {
      player.addEffect(MinecraftEffectTypes.slowFalling, 2000000000, { amplifier: 0, showParticles: false });
      return { hoverTicks: 0 };
    },
    tick(context) {
      const { player } = context;
      player.addEffect(MinecraftEffectTypes.slowFalling, 10, { amplifier: 0, showParticles: false });
      player.addEffect(MinecraftEffectTypes.jumpBoost, 10, { amplifier: 1, showParticles: false });
      player.addEffect(MinecraftEffectTypes.speed, 10, { amplifier: 0, showParticles: false });
      return context.state;
    },
    cleanup({ player }) {
      player.removeEffect(MinecraftEffectTypes.slowFalling);
      player.removeEffect(MinecraftEffectTypes.jumpBoost);
      player.removeEffect(MinecraftEffectTypes.speed);
    },
    onEntityHit({ player }, event) {
      const { hitEntity } = event;
      if (!hitEntity || !hitEntity.addEffect) {
        return;
      }
      hitEntity.addEffect(MinecraftEffectTypes.poison, 80, { amplifier: 0, showParticles: true });
      player.dimension.playSound("mob.bee.sting", hitEntity.location, { pitch: 1.2 });
    }
  }
};

export function serializeState(state) {
  try {
    const value = JSON.stringify(state ?? {});
    return value.length > MAX_STATE_LENGTH ? "{}" : value;
  } catch {
    return "{}";
  }
}

export function deserializeState(stateText) {
  if (!stateText) return {};
  try {
    return JSON.parse(stateText);
  } catch {
    return {};
  }
}
