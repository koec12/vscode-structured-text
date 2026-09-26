// SYNTAX TEST "source.iec-st" "Structured Text constructs"
FUNCTION_BLOCK fbRuntime EXTENDS fbBase
// <------------- storage.type.pou.st
//             ^^^^^^^^^ entity.name.function.st
//                       ^^^^^^^ storage.modifier.st
//                               ^^^^^^ entity.other.inherited-class.st
VAR_INPUT
// <-------- storage.modifier.var.st
    ibStart : BOOL := TRUE; //Start call
//            ^^^^ support.type.primitive.st
//                 ^^ keyword.operator.assignment.st
//                    ^^^^ constant.language.boolean.st
//                          ^^^^^^^^^^^^ comment.line.double-slash.st
    sFilter : fbExponentialLpf;
//            ^^^^^^^^^^^^^^^^ entity.name.type.st
END_VAR
{attribute 'hide'}
// <----------------- meta.preprocessor.st
If (tltTime >= T#2s) Then
// <- keyword.control.st
//             ^^^^ constant.numeric.time.st
//                   ^^^^ keyword.control.st
    tliJitter := LTime_To_LInt(tltRuntime) / 16#FF_FF;
//               ^^^^^^^^^^^^^ support.function.conversion.st
//                                           ^^^^^^^^ constant.numeric.based.st
    x := Abs(y) + fcRexLr(ilrInput := 1.5E3);
//       ^^^ support.function.builtin.st
//                ^^^^^^^ entity.name.function.call.st
//                                    ^^^^^ constant.numeric.decimal.st
Elsif a And Not b Then
// <----- keyword.control.st
//      ^^^ keyword.operator.logical.st
    ws := "wide $0041";
//        ^^^^^^^^^^^^ string.quoted.double.st
//              ^^^^^ constant.character.escape.st
    s := 'it$'s';
//       ^^^^^^^ string.quoted.single.st
//          ^^ constant.character.escape.st
    tbIn := %IX0.0;
//          ^^^^^^ variable.language.address.st
    bOut S= bIn;
//       ^^ keyword.operator.assignment.st
END_IF
(* outer (* nested *) still comment *)
// <------------------------------------- comment.block.st
///<summary>Doc</summary>
//  ^^^^^^^ entity.name.tag.st
v := DINT#16#7FFF;
//   ^^^^ support.type.literal-prefix.st
//        ^^^^^^^ constant.numeric.typed.st
THIS^.x := SUPER^.y;
// <---- variable.language.st
END_FUNCTION_BLOCK
// <------------------ storage.type.pou.st
