import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
	rules: [
		{
			type: "CompiledWasm",
			globs: [
				"**/*.wasm",
			],
			fallthrough: true,
		},
	],
});
