import { main } from "./main";

main().catch((err) => {
  console.log("ERROR:: ", err);
  process.exit(1);
});
