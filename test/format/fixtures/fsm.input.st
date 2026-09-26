VAR CONSTANT
//State Machine Constants
ciInitState : INT := 00; //Initial State of Control Element
ciLow : INT := 01; //Control Element in Low state
ciTransitHigh : INT := 02; //Control Element in transit to High state
END_VAR
VAR //Static
siState : INT ; //State of Equipment Under Control
END_VAR
//State machine
CASE siState OF
ciInitState : //Initial State of EUC
IF bHigh THEN siState := ciHigh; ELSIF bLow THEN siState := ciLow; END_IF
// EUC in Low state
ciLow: IF bSwitch THEN
siState:=ciTransitHigh;
END_IF
ciTransitHigh, ciTransitLow:
x := 1; y := 22;
ELSE
siState := ciInitState;
END_CASE;
REPEAT i := i + 1; UNTIL i > 10 END_REPEAT;
WHILE a AND
    b DO x := -1; END_WHILE
FOR tiII := tiBufferLength - 1 TO 1 BY -1 DO srBuffer[tiII + 1] := srBuffer[tiII]; END_FOR;
