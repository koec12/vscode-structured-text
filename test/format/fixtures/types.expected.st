TYPE tComplex
(*
Copyright ©<Company>. All rights reserved.
*)
    STRUCT
        rRe : Real; //Complex real part
        rIm : Real; //Complex imaginary part
    END_STRUCT
END_TYPE

TYPE uMaCommand :
    UNION
        b : tMaCommand; //For Bit Access
        w : Word;       //For Word Access
    END_UNION
END_TYPE

TYPE eColor : (Red := 0, Green, Blue);
END_TYPE
TYPE tArr : ARRAY[1..10] OF POINTER TO Int;
END_TYPE
