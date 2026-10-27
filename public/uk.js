export function plural(n,one,few,many){const value=Math.abs(n),two=value%100,last=value%10;return two>=11&&two<=14?many:last===1?one:last>=2&&last<=4?few:many;}
