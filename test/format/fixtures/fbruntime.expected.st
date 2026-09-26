(*

**©2026 <Company> - TITLE =[V#01.01.01.03] Measures task runtime and jitter**

========================  ================  ===========  =========================================
Version Number            Date              Signature    Description
========================  ================  ===========  =========================================
V#01.01.01.03             2026.06.01        <Sign>         Original version.
========================  ================  ===========  =========================================
*)

FUNCTION_BLOCK fbRuntime
(*
Copyright ©2026 <Company>. All rights reserved.
AUTHOR : <Sign>
FAMILY : System
NAME   : fbRuntime
*)

VAR CONSTANT
    {attribute 'hide'} cliNsPerUs : LInt := 1000;      //Nanoseconds per microsecond
END_VAR

VAR_INPUT
    ibStart : Bool; //Start call
    ibReset : Bool; //Reset min and max
END_VAR

VAR_OUTPUT
    qltRuntime       : LTime; // Actual runtime
    qliRuntimeJitter : LInt;  // [us] Runtime jitter
    qltRuntimeMax    : LTime; // Maximum runtime
    qltRuntimemin    : LTime; // Minimum runtime
END_VAR

VAR //Static
    {attribute 'hide'} sltNow        : LTime;
    {attribute 'hide'} sltRuntimeMax : LTime;
END_VAR

VAR_TEMP
    {attribute 'hide'} tbRestart  : Bool;
    {attribute 'hide'} tltRuntime : LTime;
    {attribute 'hide'} tliJitter  : LInt;
    {attribute 'hide'} tltNow     : LTime;
END_VAR

//Populate Temporaries
tbRestart  := gSystem.bRestart();
tltNow     := LTime();
tltRuntime := tltNow - sltNow;

//Handle restart and reset
If (ibReset Or tbRestart) Then
    sltRuntimeMax := LTime#0s;
    sltRuntimeMin := LTime#1d;
    sltNow        := tltNow;
    Return;
End_If;

//Handle start and end call
If ibStart Then
    sltNow           := tltNow;
    qltRuntime       := Ltime#0s;
    qliRuntimeJitter := 0;
    Return;
End_If;

//Handle Min/Max cycle time
If (tltRuntime > sltRuntimeMax) Then
    sltRuntimeMax := tltRuntime;
ElsIf (tltRuntime < sltRuntimeMin) Then
    sltRuntimeMin := tltRuntime;
End_If;
tliJitter := (LTime_To_LInt(tltRuntime) - sliJitter) / cliNsPerUs;
sliJitter := LTime_To_LInt(tltRuntime);

//Write to outputs
qltRuntime       := tltRuntime;
qliRuntimeJitter := tliJitter; // jitter
qltRuntimeMax    := sltRuntimeMax;
qltRuntimeMin    := sltRuntimeMin;
END_FUNCTION_BLOCK
