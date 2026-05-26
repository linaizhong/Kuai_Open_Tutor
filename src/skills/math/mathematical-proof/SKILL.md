# Skill: mathematical-proof

## Meta
- **Name**: mathematical-proof
- **Type**: active
- **Phase**: Phase 1 — Formal mathematical proof in HSC examiner format
- **Version**: 1.0.0
- **Subjects**: HSC Maths Extension 1, HSC Maths Extension 2

## Description
Handles all HSC formal proof questions for Ext 1 and Ext 2 — mathematical induction, direct proof, proof by contradiction, proof by contrapositive, inequality proofs, and complex number proofs. Automatically detects the proof type from the question and enforces the strict structural format HSC markers award marks for (base case, inductive assumption, inductive step, conclusion for induction etc.). Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "prove", "proof", "show that", "show by", "demonstrate that",
    "verify that", "establish that",
    "by induction", "mathematical induction", "induction",
    "prove by induction", "prove using induction",
    "base case", "inductive step", "inductive hypothesis",
    "prove by contradiction", "proof by contradiction",
    "assume for contradiction", "suppose for contradiction",
    "prove by contrapositive", "contrapositive",
    "direct proof", "prove directly",
    "prove the inequality", "prove that the inequality",
    "prove the identity", "prove the result",
    "prove for all", "prove for all integers", "prove for all n",
    "prove for all positive", "prove for n >= 1",
    "show the identity", "show the result", "show for all"
  ],
  "intent": "write a formal mathematical proof following HSC examiner structure"
}
```

## Inputs
- `params`: { userInput, problem, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: complete formal proof in HSC examiner format, with HSC Marker's Note
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code

## Proof types handled
| Type | Detection keywords | Ext 1 | Ext 2 |
|---|---|---|---|
| Mathematical induction | induct, by induction | ✅ | ✅ |
| Direct proof | prove that, show that | ✅ | ✅ |
| Proof by contradiction | contradiction, assume false | ✅ | ✅ |
| Proof by contrapositive | contrapositive | ✅ | ✅ |
| Inequality proof | inequality, AM-GM, Cauchy | ✅ | ✅ |
| Complex number proof | complex, De Moivre, arg, mod | — | ✅ |