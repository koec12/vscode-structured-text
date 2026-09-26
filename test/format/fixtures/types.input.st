TYPE tComplex
(*
Copyright ©<Company>. All rights reserved.
*)
STRUCT
rRe : REAL ; //Complex real part
rIm : REAL ; //Complex imaginary part
END_STRUCT
END_TYPE

TYPE uMaCommand :
UNION
 b   : tMaCommand; //For Bit Access
 w   : WORD;  //For Word Access
END_UNION
END_TYPE

TYPE eColor : (Red := 0, Green, Blue); END_TYPE
TYPE tArr : ARRAY [1..10] OF POINTER TO INT; END_TYPE
