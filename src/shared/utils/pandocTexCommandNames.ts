/**
 * Inline command names recognized by Pandoc 3.10.2's LaTeX reader, including
 * its citation, language, SIunitx, and character command tables. Unknown names
 * are deliberately absent: Pandoc considers a line of unknown commands raw
 * block TeX, rather than requiring an ever-growing block-command whitelist.
 * Source: https://github.com/jgm/pandoc/tree/3.10.2/src/Text/Pandoc/Readers/LaTeX
 */
const INLINE_TEX_COMMANDS = new Set(`
AA AE Ac Acf Acfp Acl Aclp Acp Acrfull Acrlong Acrshort Acs Acsp Autocite Autocites
Cite Cites Citeyear Citeyearpar Cref Footcite Footcites Footcitetext Footcitetexts
G GLSdesc GLSdescplural Gls Glsdesc Glsdescplural Glspl H L LaTeX MakeLowercase
MakeTextLowercase MakeTextUppercase MakeUppercase O OE P Parencite Parencites RN Rn
S SI SIlist SIrange Smartcite Supercite Supercites TeX Textcite Textcites U Verb
aa abstractname ac acf acfp acl aclp acp acrfull acrlong acrshort acs acsp
addabbrvspace adddot adddotspace ae alert ang autocap autocite autocites autoref
b backslash bar bf bfseries bibname bibstring bshyp c ccname chaptername cite
citeal citealp citealt citeauthor citep cites citet citetext citeyear citeyearpar
colonhyp colorbox contentsname copyright cref d dothyp dots dq em emph enclname
enquote ensuremath eqref euro f faCheck faClose figurename flq flqq footcite
footcites footcitetext footcitetexts footnote footnotemark footnotetext
foreignlanguage foreignquote frq frqq fshyp glossaryname glq glqq gls glsdesc
glsdescplural glspl grq grqq guillemetleft guillemetright guillemotleft
guillemotright guilsinglleft guilsinglright h hbox headtoname hl href hyp hyperlink
hyperref hypertarget hyphen hyphenquote i ifdim iftoggle includegraphics includesvg
index indexname it itshape j k l label ldots lettrine listfigurename listtablename
lowercase lq lstinline lstlistingname mbox mdots mintinline mkbibbold mkbibbrackets
mkbibemph mkbibitalic mkbibparens mkbibquote newline newtie newtoggle nhttfamily
nocite nohyphens noindent nolinkurl num numlist numrange o oe pagename pandocbounded
parencite parencites partname passthrough pounds prefacename proofname ps qed qty
qtylist qtyrange quotedblbase quotesinglbase r ref refname rm rq scshape seealsoname
seename sep si sim sl slash slshape smartcite sout ss st supercite supercites t
tablename texorpdfstring textafrikaans textalbanian textamharic textarabic
textarmenian textasciicircum textasciitilde textassamese textasturian textbackslash
textbaht textbasque textbengali textbf textbigcircle textblank textbreton
textbrokenbar textbulgarian textbullet textcatalan textcentoldstyle textcircled
textcite textcites textcolor textcoptic textcopyright textcroatian textczech
textdagger textdanish textdegree textdivehi textdollar textdong textdutch
textenglish textesperanto textestonian textethiopic textfarsi textfinnish
textfrench textfriulan textgalician textgerman textgreater textgreek textgujarati
texthebrew texthindi texticelandic textindonesian textinterlingua textirish textit
textitalian textjapanese textkannada textkhmer textkorean textkurmanji textlao
textlatin textlatvian textless textlira textlithuanian textlsorbian textmagyar
textmalayalam textmarathi textmd textmongolian textmu textmusicalnote textnhtt
textnko textnormal textnorsk textnynorsk textoccitan textogonekcentered textonehalf
textonequarter textoriya textparagraph textpertenthousand textpeso textpiedmontese
textpinyin textpolish textportuguese textpunjabi textquotedbl textquotedblleft
textquotedblright textquoteleft textquoteright textquotesingle textregistered
textrm textromanian textromansh textrussian textsamin textsanskrit textsc
textscottish textsection textserbian textserbianc textsf textsl textslovak
textslovenian textspanish textsterling textsubscript textsuperscript textswedish
textsyriac texttamil texttelugu textthai textthreequarters textthreesuperior
texttibetan texttt textturkish textturkmen texttwosuperior textukrainian textup
texturdu textusorbian textvietnamese textwelsh textyen thanks today togglefalse
toggletrue tt u ul uline underline unit uppercase url v vbox vdots verb vref
`.trim().split(/\s+/));

export function isPandocInlineTexCommand(name: string): boolean {
    return INLINE_TEX_COMMANDS.has(name);
}
