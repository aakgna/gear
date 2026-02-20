/**
 * Rule runner for custom game definitions.
 * Resolves ValueRefs, evaluates Conditions, and executes Actions in order.
 */
import type {
	Rule,
	Condition,
	Action,
	ValueRef,
	RuntimeEventType,
} from "../config/gameDefinition";

export interface RuleContext {
	event: RuntimeEventType;
	objectId?: string;
	payload?: { dtMs?: number; value?: string };
	state: Record<string, unknown>;
}

function resolveRef(ctx: RuleContext, ref: ValueRef): unknown {
	switch (ref.from) {
		case "const":
			return ref.value;
		case "object":
			if (ref.path === "objectId") return ctx.objectId;
			return (ctx as any).object?.[ref.path];
		case "state":
			return ctx.state[ref.path];
		default:
			return undefined;
	}
}

function evaluateCondition(ctx: RuleContext, cond: Condition): boolean {
	switch (cond.op) {
		case "always":
			return true;
		case "eq": {
			const a = resolveRef(ctx, cond.a);
			const b = resolveRef(ctx, cond.b);
			return a === b;
		}
		case "not":
			return !evaluateCondition(ctx, cond.cond);
		default:
			return false;
	}
}

/**
 * Run all rules for the current event. Mutates ctx.state. Returns "win" | "lose" if any action was END_GAME, else null.
 */
export function runRules(
	rules: Rule[],
	ctx: RuleContext
): "win" | "lose" | null {
	for (const rule of rules) {
		if (rule.event !== ctx.event) continue;
		if (rule.if !== undefined && !evaluateCondition(ctx, rule.if)) continue;
		for (const action of rule.then) {
			const result = executeAction(ctx, action);
			if (result) return result;
		}
	}
	return null;
}

function executeAction(ctx: RuleContext, action: Action): "win" | "lose" | null {
	switch (action.type) {
		case "ADD_SCORE": {
			const current = (ctx.state.score as number) ?? 0;
			ctx.state.score = current + action.amount;
			return null;
		}
		case "END_GAME":
			return action.result;
		case "SET_STATE":
			ctx.state[action.key] = action.value;
			return null;
		default:
			return null;
	}
}
