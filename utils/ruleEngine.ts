import { GameRule, GameComponent } from "../stores/gameBuilderStore";

export type RuleValidationResult = {
	valid: boolean;
	error?: string;
};

export const validateRule = (
	rule: GameRule,
	component: GameComponent,
	componentValue: any
): RuleValidationResult => {
	switch (rule.type) {
		case "exactMatch":
			const expected = rule.params.expected;
			if (componentValue !== expected) {
				return {
					valid: false,
					error: rule.errorMessage || `Value must be "${expected}"`,
				};
			}
			return { valid: true };

		case "contains":
			const substring = rule.params.substring || "";
			const caseSensitive = rule.params.caseSensitive || false;
			const valueStr = String(componentValue);
			const searchStr = caseSensitive ? valueStr : valueStr.toLowerCase();
			const searchSub = caseSensitive ? substring : substring.toLowerCase();
			if (!searchStr.includes(searchSub)) {
				return {
					valid: false,
					error: rule.errorMessage || `Value must contain "${substring}"`,
				};
			}
			return { valid: true };

		case "pattern":
			try {
				const pattern = new RegExp(rule.params.pattern || "", rule.params.flags || "");
				if (!pattern.test(String(componentValue))) {
					return {
						valid: false,
						error: rule.errorMessage || "Value does not match pattern",
					};
				}
				return { valid: true };
			} catch (e) {
				return {
					valid: false,
					error: "Invalid regex pattern",
				};
			}

		case "sumEquals":
			if (Array.isArray(componentValue)) {
				const sum = componentValue.reduce((a: number, b: number) => a + b, 0);
				if (sum !== rule.params.target) {
					return {
						valid: false,
						error: rule.errorMessage || `Sum must equal ${rule.params.target}`,
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Value must be an array" };

		case "rowSum":
			if (component.type === "grid" && Array.isArray(componentValue)) {
				const row = rule.params.row || 0;
				const cols = component.properties?.cols || 3;
				const rowStart = row * cols;
				const rowEnd = rowStart + cols;
				const rowValues = componentValue.slice(rowStart, rowEnd);
				const sum = rowValues.reduce((a: number, b: number) => a + b, 0);
				if (sum !== rule.params.target) {
					return {
						valid: false,
						error: rule.errorMessage || `Row ${row} sum must equal ${rule.params.target}`,
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Rule only applies to grid components" };

		case "colSum":
			if (component.type === "grid" && Array.isArray(componentValue)) {
				const col = rule.params.col || 0;
				const cols = component.properties?.cols || 3;
				const rows = component.properties?.rows || 3;
				const colValues: number[] = [];
				for (let row = 0; row < rows; row++) {
					const index = row * cols + col;
					if (componentValue[index] !== null && componentValue[index] !== undefined) {
						colValues.push(componentValue[index]);
					}
				}
				const sum = colValues.reduce((a: number, b: number) => a + b, 0);
				if (sum !== rule.params.target) {
					return {
						valid: false,
						error: rule.errorMessage || `Column ${col} sum must equal ${rule.params.target}`,
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Rule only applies to grid components" };

		case "cellEquals":
			if (component.type === "grid" && Array.isArray(componentValue)) {
				const cellIndex = rule.params.cellIndex || 0;
				const expected = rule.params.expected;
				if (componentValue[cellIndex] !== expected) {
					return {
						valid: false,
						error: rule.errorMessage || `Cell ${cellIndex} must equal ${expected}`,
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Rule only applies to grid components" };

		case "allUnique":
			if (Array.isArray(componentValue)) {
				const unique = new Set(componentValue);
				if (unique.size !== componentValue.length) {
					return {
						valid: false,
						error: rule.errorMessage || "All values must be unique",
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Value must be an array" };

		case "sequence":
			if (Array.isArray(componentValue)) {
				const expected = rule.params.expected || [];
				if (JSON.stringify(componentValue) !== JSON.stringify(expected)) {
					return {
						valid: false,
						error: rule.errorMessage || "Sequence does not match expected",
					};
				}
				return { valid: true };
			}
			return { valid: false, error: "Value must be an array" };

		default:
			return { valid: false, error: "Unknown rule type" };
	}
};

export const validateAllRules = (
	rules: GameRule[],
	components: GameComponent[],
	componentValues: Record<string, any>
): RuleValidationResult[] => {
	return rules.map((rule) => {
		const component = components.find((c) => c.id === rule.targetComponentId);
		if (!component) {
			return { valid: false, error: "Component not found" };
		}
		const value = componentValues[component.id];
		return validateRule(rule, component, value);
	});
};

