{attribute 'qualified_only'}
INTERFACE iMotor EXTENDS iBase
METHOD mStart : Bool
VAR_INPUT
    ibForce : Bool;
END_VAR
END_METHOD
END_INTERFACE

FUNCTION_BLOCK PUBLIC fbMotor EXTENDS fbBase IMPLEMENTS iMotor
VAR_INPUT
    RX : Bool;   //Initialize filter
END_VAR;

VAR //Static Data
    sbRx   : Bool;   //Initialize filter
    sRef   : REFERENCE TO Int;
    spData : POINTER TO tData;
END_VAR;

VAR_TEMP
    tbRx : Bool;    //Initialize filter
END_VAR;
BEGIN
tbRx := RX And Not sbRx; //tbRx is positive edge for RX
sbRx := RX;              //Save RX in sbRx to disable edge as long as RX stays true.
{IF defined (DEBUG)}
If tbRx Then
    This^.mLog(sMsg := 'edge');
End_If;
{END_IF}
spData := __New(tData);
sRef REF= siValue;
If ((tbyXa And 16#01) <> 16#00) Then  //Test for positive edge on bit zero in the byte
    sbAlarm S= true;
End_If
METHOD PRIVATE mLog : Bool
VAR_INPUT
    sMsg : String(80);
END_VAR
mLog := true;
END_METHOD

PROPERTY pbRunning : Bool
END_PROPERTY
END_FUNCTION_BLOCK
