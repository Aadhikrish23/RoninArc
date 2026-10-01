import { runRegistryTests } from "./registry.test";
import { runManifestTests } from "./manifest.test";
import { runValidatorTests } from "./validator.test";
import { runArchitectureTests } from "./architecture.test";

async function main() {
  console.log("=========================================");
  console.log("RUNNING AI RUNTIME V2 SPRINT 1 TEST SUITE");
  console.log("=========================================");

  let failedCount = 0;
  const suites = [
    { name: "Registry Isolation & Operations", run: runRegistryTests },
    { name: "Validation Constraints", run: runValidatorTests },
    { name: "Product Manifest Loaders", run: runManifestTests },
    { name: "Architectural and Reference Invariants", run: runArchitectureTests }
  ];

  for (const suite of suites) {
    console.log(`\nSuite: ${suite.name}`);
    try {
      await suite.run();
      console.log(`✅ Passed: ${suite.name}`);
    } catch (error: any) {
      failedCount++;
      console.error(`❌ Failed: ${suite.name}`);
      console.error(error.stack || error);
    }
  }

  console.log("\n=========================================");
  if (failedCount === 0) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error(`💥 ${failedCount} SUITE(S) ENCOUNTERED ERRORS.`);
    process.exit(1);
  }
}

main();
