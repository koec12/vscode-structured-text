{attribute 'qualified_only'}
INTERFACE iMotor EXTENDS iBase
METHOD mStart : BOOL
VAR_INPUT
ibForce : BOOL;
END_VAR
END_METHOD
END_INTERFACE

FUNCTION_BLOCK PUBLIC fbMotor EXTENDS fbBase IMPLEMENTS iMotor
VAR_INPUT
    RX   : Bool ;   //Initialize filter
END_VAR;
VAR //Static Data
    sbRx  : Bool ;   //Initialize filter
    sRef : REFERENCE TO INT;
    spData : POINTER TO tData;
END_VAR;
VAR_TEMP
    tbRx         : Bool ;    //Initialize filter
END_VAR;
BEGIN
tbRx   := RX And Not sbRx; //tbRx is positive edge for RX
sbRx   := RX;              //Save RX in sbRx to disable edge as long as RX stays true.
{IF defined (DEBUG)}
If tbRx Then
    THIS^.mLog(sMsg := 'edge');
End_If;
{END_IF}
spData := __NEW(tData);
sRef REF= siValue;
IF ((tbyXa AND 16#01) <> 16#00) THEN  //Test for positive edge on bit zero in the byte
    sbAlarm S= TRUE;
END_IF
METHOD PRIVATE mLog : BOOL
VAR_INPUT
    sMsg : STRING(80);
END_VAR
mLog := TRUE;
END_METHOD

PROPERTY pbRunning : BOOL
END_PROPERTY
END_FUNCTION_BLOCK
