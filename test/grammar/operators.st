// SYNTAX TEST "source.iec-st" "operator scopes"
x := (a >= b) Or (c <> d) And Not e;
//^^ keyword.operator.assignment.st
//      ^^ keyword.operator.comparison.st
//            ^^ keyword.operator.logical.st
//                  ^^ keyword.operator.comparison.st
//                        ^^^ keyword.operator.logical.st
//                            ^^^ keyword.operator.logical.st
y := a = b & c < d Xor e > f;
//     ^ keyword.operator.comparison.st
//         ^ keyword.operator.logical.st
//             ^ keyword.operator.comparison.st
//                 ^^^ keyword.operator.logical.st
//                       ^ keyword.operator.comparison.st
z := a MOD b + c;
//     ^^^ keyword.operator.arithmetic.st
//           ^ keyword.operator.arithmetic.st
bOut S= bIn;
//   ^^ keyword.operator.assignment.st
sFb(ibIn := x, qbOut => y);
//       ^^ keyword.operator.assignment.st
//                   ^^ keyword.operator.assignment.st
If a AND_THEN b OR_ELSE c <= d Then
// ^ source.iec-st
//   ^^^^^^^^ keyword.operator.logical.st
//              ^^^^^^^ keyword.operator.logical.st
//                        ^^ keyword.operator.comparison.st
End_If
