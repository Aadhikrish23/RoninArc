// TEMP DEBUG ONLY

import { LLMIntentResponse, LLMIntent, LLMIntentTarget, LLMIntentParameter } from "../providers/contracts/LLMIntentResponse";
import { IntentType } from "../intent/IntentType";
import { IntentTargetType } from "../intent/IntentTargetType";
import { IntentParameterType } from "../intent/IntentParameterType";

export function validateLLMIntentResponse(parsed: unknown): LLMIntentResponse {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid LLMIntentResponse structure: Root must be an object.");
  }

  const data = parsed as any;

  if (!Array.isArray(data.intents)) {
    throw new Error("Invalid LLMIntentResponse: 'intents' must be an array.");
  }

  const validatedIntents: LLMIntent[] = [];

  for (let i = 0; i < data.intents.length; i++) {
    const intent = data.intents[i];
    if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
      throw new Error(`Invalid intent at index ${i}: Intent must be an object.`);
    }

    if (!Object.values(IntentType).includes(intent.type)) {
      throw new Error(`Invalid intent type at index ${i}: '${intent.type}' is not a valid IntentType.`);
    }

    const targets = intent.targets || [];
    if (!Array.isArray(targets)) {
      throw new Error(`Invalid intent targets at index ${i}: 'targets' must be an array.`);
    }

    const parameters = intent.parameters || [];
    if (!Array.isArray(parameters)) {
      throw new Error(`Invalid intent parameters at index ${i}: 'parameters' must be an array.`);
    }

    const validatedTargets: LLMIntentTarget[] = [];
    for (let j = 0; j < targets.length; j++) {
      const target = targets[j];
      if (!target || typeof target !== "object" || Array.isArray(target)) {
        throw new Error(`Invalid target at intent ${i}, target ${j}: Target must be an object.`);
      }

      if (!Object.values(IntentTargetType).includes(target.type)) {
        throw new Error(`Invalid target type at intent ${i}, target ${j}: '${target.type}' is not a valid IntentTargetType.`);
      }

      if (typeof target.name !== "string") {
        throw new Error(`Invalid target name at intent ${i}, target ${j}: 'name' must be a string.`);
      }

      validatedTargets.push({
        type: target.type as IntentTargetType,
        name: target.name,
      });
    }

    const validatedParameters: LLMIntentParameter[] = [];
    for (let k = 0; k < parameters.length; k++) {
      const param = parameters[k];
      if (!param || typeof param !== "object" || Array.isArray(param)) {
        throw new Error(`Invalid parameter at intent ${i}, parameter ${k}: Parameter must be an object.`);
      }

      if (!Object.values(IntentParameterType).includes(param.type)) {
        throw new Error(`Invalid parameter type at intent ${i}, parameter ${k}: '${param.type}' is not a valid IntentParameterType.`);
      }

      const valType = typeof param.value;
      if (valType !== "string" && valType !== "number" && valType !== "boolean") {
        throw new Error(`Invalid parameter value at intent ${i}, parameter ${k}: 'value' must be a string, number, or boolean.`);
      }

      validatedParameters.push({
        type: param.type as IntentParameterType,
        value: param.value,
      });
    }

    validatedIntents.push({
      type: intent.type as IntentType,
      targets: validatedTargets,
      parameters: validatedParameters,
    });
  }

  return {
    intents: validatedIntents,
  };
}
