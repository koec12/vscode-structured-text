VAR CONSTANT
    //State Machine Constants
    ciInitState   : Int := 00; //Initial State of Control Element
    ciLow         : Int := 01; //Control Element in Low state
    ciTransitHigh : Int := 02; //Control Element in transit to High state
END_VAR

VAR //Static
    siState : Int; //State of Equipment Under Control
END_VAR
//State machine
Case siState Of
    ciInitState: //Initial State of EUC
        If bHigh Then
            siState                     := ciHigh;
        ElsIf bLow Then
            siState                     := ciLow;
        End_If
    // EUC in Low state
    ciLow:
        If bSwitch Then
            siState                     := ciTransitHigh;
        End_If
    ciTransitHigh, ciTransitLow:
        x                               := 1;
        y                               := 22;
    Else
        siState                         := ciInitState;
End_Case;
Repeat
    i                                   := i + 1;
Until i > 10
End_Repeat;
While a And
        b Do
    x                                   := -1;
End_While
For tiII := tiBufferLength - 1 To 1 By -1 Do
    srBuffer[tiII + 1]                  := srBuffer[tiII];
End_For;
