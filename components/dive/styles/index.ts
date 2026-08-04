/**
 * Merged Dive CSS modules — one import surface for components.
 * Class names must stay unique across the split files.
 */
import dive from "./dive.module.css";
import wizard from "./wizard.module.css";
import hub from "./hub.module.css";
import instacue from "./instacue.module.css";
import numerals from "./numerals.module.css";
import quiz from "./quiz.module.css";

const styles = {
  ...dive,
  ...wizard,
  ...hub,
  ...instacue,
  ...numerals,
  ...quiz,
} as typeof dive &
  typeof wizard &
  typeof hub &
  typeof instacue &
  typeof numerals &
  typeof quiz;

export default styles;
