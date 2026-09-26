(*
**©2026 <Company> - TITLE ='[V#01.01.01.03] Switch Binary - Bistable actuator'**

========================  ================  ===========  =========================================
Version Number            Date              Signature    Description
========================  ================  ===========  =========================================
V#01.01.01.03             2026.09.26        <Sign>       Original version.
========================  ================  ===========  =========================================

Functionality
=======================
Sample file for the extension - run "Format Document" and look at the Problems view.
*)
FUNCTION_BLOCK fbSwitchBistable
VAR_TEMP
tbRestart : BOOL;
tltNow : LTIME;
tltTime : LTIME;
END_VAR
VAR_INPUT
XGH : BOOL; //Active feedback
XGL : BOOL; //Passive feedback
XH : BOOL; //Activate in automatic mode
XL : BOOL; //Passivate in automatic mode
PTDH : LTIME := LT#10S; //Maximum transit time to high
END_VAR
VAR_OUTPUT
YH : BOOL; //Activate
YL : BOOL; //Passivate
YF : BOOL; //Fault
END_VAR
VAR CONSTANT
ciInitState : INT := 0; //Initial state
ciLow : INT := 1; //Low state
ciTransitHigh : INT := 2; //Transit to high
ciHigh : INT := 3; //High state
END_VAR
VAR
siState : INT; //State of equipment under control
sltTime : LTIME; //Timer start
state_old : INT;
END_VAR

//Populate temporaries
tbRestart := gSystem.bRestart(); tltNow := gSystem.ltTimeTick;
tltTime := tltNow - sltTime;

IF tbRestart THEN siState := ciInitState; sltTime := tltNow; RETURN; END_IF

//State machine
CASE siState OF
ciInitState: IF XGH THEN siState := ciHigh; ELSIF XGL THEN siState := ciLow; END_IF
ciLow: IF XH AND NOT XL THEN siState := ciTransitHigh; sltTime := tltNow; END_IF
ciTransitHigh:
IF XGH THEN siState := ciHigh;
ELSIF tltTime > PTDH AND NOT XGH THEN YF := TRUE;
END_IF
3: IF XL THEN siState := ciLow; END_IF
END_CASE

//Write to outputs
YH := siState = ciTransitHigh;
YL := siState = ciLow AND NOT XGL;
END_FUNCTION_BLOCK
