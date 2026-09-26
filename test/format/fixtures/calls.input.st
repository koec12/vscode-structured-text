tOutput := fcRexLr( //Check for legal real number
ilrInput := tlrInput,
ilrSubstituteValue := 0.0);
sFilter( //Filter Analogue Input
   ilrInput           := trY, ibReset := tbRestart,
   ilrSubstituteValue := 0.0,
   iltTimeConstant    := PTC, qlrOutput => tlrY);
tlrY := sFilter.qlrOutput;
tbYf := sFilter.qbFault;
sTimer(IN := bStart, PT := T#5s);
x := MAX(a, b) + ABS(-c) * SQRT(d);
aFb[i](ibIn := x,
  ibEnable := TRUE);
