export interface DatosContrato {
  t: (seccion: string, clave: string) => string;
  dinero: (seccion: string, clave: string) => string;
  fecha: (seccion: string, clave: string) => string;
  domicilio: string;
}

const CORTES_DE_PAGINA: Array<[number, string]> = [
  [2, "D. Su domicilio"],
  [3, "CLÁUSULAS"],
  [4, "El Subarrendatario será responsable frente al Subarrendador de cualesquiera daños"],
  [5, "SÉPTIMA."],
  [6, "DÉCIMA. Obras"],
  [7, "DÉCIMA SEGUNDA."],
  [8, "DÉCIMA CUARTA."],
  [9, "DÉCIMA NOVENA."],
  [10, "Los daños ocasionados al Inmueble"],
  [11, "que éste deba efectuar"],
  [12, "TRIGÉSIMA TERCERA."],
  [13, "TRIGÉSIMA SEXTA."],
];

function conPagina(
  bloques: Array<{ tipo: "titulo" | "seccion" | "texto"; texto: string }>,
): Array<{ tipo: "titulo" | "seccion" | "texto"; texto: string; pagina: number }> {
  let pagina = 1;
  let corte = 0;
  return bloques.map((bloque) => {
    while (
      corte < CORTES_DE_PAGINA.length &&
      bloque.texto.startsWith(CORTES_DE_PAGINA[corte][1])
    ) {
      pagina = CORTES_DE_PAGINA[corte][0];
      corte += 1;
    }
    return { ...bloque, pagina };
  });
}

export function parrafosContrato(
  d: DatosContrato,
): Array<{ tipo: "titulo" | "seccion" | "texto"; texto: string; pagina: number }> {
  const b = (valor: string) => `{{${valor}}}`;
  const corp = b(d.t("extras", "corporativo"));
  const destino = b(d.t("inmueble", "destino"));
  return conPagina([
    { tipo: "titulo", texto: "CONTRATO DE SUBARRENDAMIENTO LOCAL COMERCIAL" },
    {
      tipo: "texto",
      texto:
        `CONTRATO DE SUBARRENDAMIENTO QUE CELEBRAN, POR UNA PARTE, LA SOCIEDAD DENOMINADA ${b(d.t("subarrendador", "razonSocial"))} ` +
        `REPRESENTADA EN ESTE ACTO POR ${b(d.t("subarrendador", "representante"))} (EL “SUBARRENDADOR”); POR OTRA PARTE, ` +
        `${b(d.t("subarrendatario", "nombre"))} (EL “SUBARRENDATARIO”); POR ÚLTIMO, ${b(d.t("obligadoSolidario", "nombre"))} ` +
        `(EL “OBLIGADO SOLIDARIO”); CONJUNTAMENTE DENOMINADOS “LAS PARTES” DE CONFORMIDAD CON LAS DECLARACIONES Y CLÁUSULAS QUE A CONTINUACIÓN SE EXPRESAN:`,
    },
    { tipo: "seccion", texto: "DECLARACIONES" },
    { tipo: "seccion", texto: "I. EL SUBARRENDADOR DECLARA A TRAVÉS DE SU APODERADO LEGAL QUE:" },
    {
      tipo: "texto",
      texto:
        `A. Es una sociedad debidamente constituida y con personalidad jurídica de conformidad con las leyes de los Estados Unidos Mexicanos, ` +
        `lo que se acredita mediante instrumento público número ${b(d.t("subarrendador", "numeroEscrituraConstitutiva"))}, ` +
        `de fecha ${b(d.fecha("subarrendador", "fechaEscrituraConstitutiva"))}, otorgado ante la fe del notario que suscribe el instrumento, ` +
        `con residencia en los Estados Unidos Mexicanos.`,
    },
    {
      tipo: "texto",
      texto:
        `B. Su apoderado cuenta con las facultades necesarias y suficientes para celebrar el presente Contrato, lo que se acredita mediante instrumento público número ` +
        `${b(d.t("subarrendador", "numeroEscrituraPoder"))}, de fecha ${b(d.fecha("subarrendador", "fechaEscrituraPoder"))}, otorgado ante la fe de ` +
        `${b(d.t("subarrendador", "notarioPoder"))}, titular de la Notaría Pública número ${b(d.t("subarrendador", "numeroNotariaPoder"))}, ` +
        `con residencia en ${b(d.t("subarrendador", "ciudadNotariaPoder"))}.`,
    },
    {
      tipo: "texto",
      texto:
        `C. Su domicilio para los efectos legales que deriven del presente Contrato es: ${b(d.t("subarrendador", "domicilio"))}, ` +
        `su correo electrónico de contacto es: ${b(d.t("subarrendador", "correo"))} y su número telefónico es: ${b(d.t("subarrendador", "telefono"))}.`,
    },
    {
      tipo: "texto",
      texto:
        `D. Señala como domicilio alterno para los efectos legales del presente Contrato: ${b(d.t("subarrendador", "domicilioAlterno"))}, ` +
        `y el correo electrónico alterno de contacto: ${b(d.t("subarrendador", "correoAlterno"))}.`,
    },
    {
      tipo: "texto",
      texto:
        `E. Tiene la facultad para rentar el Inmueble ubicado en: ${b(d.domicilio)} con una superficie de ${b(d.t("inmueble", "superficieM2"))} m2 ` +
        `(en lo sucesivo identificado como el “Inmueble”).`,
    },
    {
      tipo: "texto",
      texto:
        "F. El Inmueble se encuentra en perfecto estado de conservación, al corriente en sus contribuciones fiscales, federales, estatales y de cualquier otro servicio.",
    },
    {
      tipo: "texto",
      texto:
        `G. El Inmueble cuenta con uso de suelo ${b(d.t("inmueble", "usoSuelo"))} y por lo tanto puede ser destinado para uso de ${destino}.`,
    },
    {
      tipo: "texto",
      texto:
        "H. Por medio del presente Contrato es su deseo otorgar el uso y goce temporal del Inmueble, en el estado y condiciones físicas que se encuentra a la fecha y que son del conocimiento del Subarrendatario, de conformidad con los lineamientos y términos establecidos en este instrumento.",
    },
    {
      tipo: "texto",
      texto:
        "I. No tiene conocimiento sobre si el Subarrendatario se encuentra o ha estado involucrado directa o indirectamente, en la comisión de delitos, particularmente aquellos que establece la Ley Nacional de Extinción de Dominio, así como sus correlativos y aplicables.",
    },
    { tipo: "seccion", texto: "II. EL SUBARRENDATARIO DECLARA QUE:" },
    {
      tipo: "texto",
      texto:
        `A. Es persona física, de nacionalidad ${b(d.t("subarrendatario", "nacionalidad"))}, con capacidad legal, plena y suficiente para celebrar el presente Contrato y obligarse en los términos del mismo.`,
    },
    {
      tipo: "texto",
      texto: `B. Se encuentra inscrito en el Registro Federal de Contribuyentes (R.F.C.) bajo la clave: ${b(d.t("subarrendatario", "rfc"))}.`,
    },
    {
      tipo: "texto",
      texto: `C. Su domicilio fiscal se encuentra ubicado en: ${b(d.t("subarrendatario", "domicilioFiscal"))}.`,
    },
    {
      tipo: "texto",
      texto:
        `D. Su domicilio para los efectos del presente Contrato es el del Inmueble, su correo electrónico de contacto es: ${b(d.t("subarrendatario", "correo"))} ` +
        `y su número telefónico es: ${b(d.t("subarrendatario", "telefono"))}.`,
    },
    {
      tipo: "texto",
      texto:
        "E. Es su deseo celebrar el presente Contrato con el Subarrendador como medio para recibir el uso y goce temporal del Inmueble, sujeto a los términos que se establecen en este instrumento.",
    },
    {
      tipo: "texto",
      texto:
        "F. Conoce las declaraciones vertidas por el Subarrendador, así como el estado del Inmueble, por los que manifiesta su conformidad en ellos.",
    },
    {
      tipo: "texto",
      texto:
        "G. Cuenta con la solvencia y los recursos económicos suficientes, así como con la capacidad necesaria, para poder cumplir puntualmente con todas y cada una de las obligaciones a su cargo establecidas en términos del presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "H. Destinará el Inmueble únicamente para actividades apegadas a la ley, y que de ninguna manera, está, ni estará en ninguno de los supuestos que prevé la Ley Nacional de Extinción de Dominio y sus correlativos para las demás entidades de la República Mexicana.",
    },
    { tipo: "seccion", texto: "III. El Obligado Solidario declara que:" },
    {
      tipo: "texto",
      texto:
        `A. ${b(d.t("obligadoSolidario", "nombre"))} es una persona física, con capacidad legal, plena y suficiente para celebrar el presente Contrato y obligarse en los términos del mismo.`,
    },
    {
      tipo: "texto",
      texto: `B. Su Clave Única de Registro de Población (CURP) es: ${b(d.t("obligadoSolidario", "curp"))}.`,
    },
    {
      tipo: "texto",
      texto:
        `C. Su domicilio para los efectos legales que deriven del presente Contrato es: ${b(d.t("obligadoSolidario", "domicilio"))}, ` +
        `su correo electrónico de contacto es: ${b(d.t("obligadoSolidario", "correo"))} y su número telefónico es: ${b(d.t("obligadoSolidario", "telefono"))}.`,
    },
    {
      tipo: "texto",
      texto:
        "D. La celebración y cumplimiento de este Contrato no resulta en un incumplimiento de cualquier contrato, orden, instrumento, concesión, sentencia o decreto del que sea parte o al que estén sujetos cualquiera de sus bienes.",
    },
    {
      tipo: "texto",
      texto:
        "E. Cuenta con todos y cada uno de los recursos económicos suficientes y necesarios para cumplir con sus obligaciones derivadas del presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "F. Las declaraciones del Obligado Solidario mencionadas en el presente Contrato son verdaderas, ciertas y no omiten información alguna para que el Subarrendador evalúe la celebración del presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "G. Es su intención celebrar el presente Contrato a efecto de obligarse solidariamente con el Subarrendatario de conformidad con los términos y condiciones establecidos en el presente Contrato.",
    },
    { tipo: "seccion", texto: "IV. Las Partes, declaran de manera conjunta que:" },
    {
      tipo: "texto",
      texto:
        "A. El presente Contrato se encuentra libre de error, dolo, mala fe, lesiones o cualquier otro vicio del consentimiento que pudiese derivarse en nulidad.",
    },
    {
      tipo: "texto",
      texto:
        "B. Los recursos que componen su patrimonio no provienen de terceros, testaferros, ni de hechos o actos delictivos, contrabando, corrupción, fraude, extorsión, evasión fiscal, narcotráfico, captación ilegal de dinero y en general de ninguna actividad ilícita realizada ya sea en el territorio nacional o en el extranjero en términos del Código Penal Federal y/o Códigos locales aplicables.",
    },
    {
      tipo: "texto",
      texto:
        "C. En este acto comparecen con la intención de quedar legalmente obligados bajo los términos del presente Contrato, y por lo tanto tienen pleno conocimiento de las implicaciones jurídicas de sus obligaciones.",
    },
    {
      tipo: "texto",
      texto:
        "Expuestas las anteriores declaraciones, las Partes convienen en celebrar el presente Contrato, sujetando su realización y cumplimiento a la observancia de lo pactado en las siguientes:",
    },
    { tipo: "seccion", texto: "CLÁUSULAS" },
    {
      tipo: "texto",
      texto:
        `PRIMERA. Objeto. El Subarrendador otorga el uso y goce temporal del Inmueble ubicado en ${b(d.domicilio)} al Subarrendatario, quien acepta expresamente dicho uso y goce.`,
    },
    {
      tipo: "texto",
      texto:
        `El día ${b(d.fecha("condiciones", "fechaEntrega"))} (en lo sucesivo denominada la “Fecha de Entrega”) el Subarrendador entregará la posesión del Inmueble al Subarrendatario de conformidad con los términos y condiciones establecidos en el presente Contrato.`,
    },
    {
      tipo: "texto",
      texto:
        `SEGUNDA. Periodo de gracia. El Subarrendador otorgará a favor del Subarrendatario un periodo de gracia de ${b(d.t("condiciones", "diasGracia"))} días, a partir de la Fecha de Entrega establecida en la cláusula primera.`,
    },
    {
      tipo: "texto",
      texto:
        `Lo anterior para efecto de que el Subarrendatario realice las adecuaciones al local en cuanto a obra civil, y adecuaciones necesarias para la instalación de mobiliario y para la operación de ${destino}; consecuentemente, el Subarrendatario queda exento del pago de la Renta del periodo aquí descrito.`,
    },
    {
      tipo: "texto",
      texto:
        `El Subarrendador autoriza el acceso al Subarrendatario, así como al personal que éste designe, incluyendo de manera enunciativa más no limitativa a arquitectos, ingenieros, contratistas, electricistas, carpinteros, proveedores, instaladores, personal de obra y demás terceros relacionados con los trabajos de adecuación del Inmueble durante el periodo de gracia.`,
    },
    {
      tipo: "texto",
      texto:
        `El acceso señalado deberá realizarse conforme a las reglas, horarios, medidas de seguridad y lineamientos establecidos por la administración de ${corp} y/o el Subarrendador, procurando en todo momento evitar afectaciones a las áreas comunes, establecimientos vecinos y operación del inmueble.`,
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario será responsable de que todas las personas que ingresen al Inmueble con motivo de los trabajos de adecuación cumplan con las disposiciones aplicables y responderá por cualquier daño o afectación que pudieran ocasionar al Inmueble, áreas comunes o a terceros.",
    },
    {
      tipo: "texto",
      texto:
        `El Subarrendador hace entrega al Subarrendatario del Manual de Adecuaciones de ${corp}, mismo que contiene los lineamientos, especificaciones técnicas, requisitos y condiciones que deberán observarse para la ejecución de cualquier obra, instalación o modificación dentro del Inmueble. El Subarrendatario se obliga a cumplir con dicho Manual durante todo el proceso de adecuación.`,
    },
    {
      tipo: "texto",
      texto: `TERCERA. Destino. El Subarrendatario destinará el Inmueble única y exclusivamente para los siguientes usos: ${destino}.`,
    },
    {
      tipo: "texto",
      texto:
        "En ningún caso el Subarrendatario podrá ampliar o variar el destino del Inmueble para un uso distinto al antes mencionado, sino mediante la autorización del Subarrendador.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario se obliga a dar cumplimiento a los horarios de funcionamiento permitidos para el Inmueble, de conformidad con lo establecido en la normativa estatal aplicable, por lo que no permitirá que clientes permanezcan en el interior después del horario autorizado.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario acepta en este acto que usará el Inmueble en una forma cuidadosa, segura y adecuada y se obliga a: (i) no guardar productos o sustancias ilícitas o de otra forma consideradas como ilegales por la legislación aplicable; (ii) no llevar a cabo cualquier actividad ilícita o en contravención de las leyes federales, estatales y locales, o de otra forma sancionadas por la legislación aplicable.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario será responsable frente al Subarrendador de cualesquiera daños y perjuicios que se llegaren a ocasionar por cualquier causa que derive de lo anterior.",
    },
    {
      tipo: "texto",
      texto:
        "Las Partes convienen que se podrá documentar el estado y condiciones físicas del Inmueble al momento de la entrega mediante fotografías a color, al correo que se señala en las declaraciones de las Partes. Las Partes otorgarán su consentimiento respecto a lo advertido en la notificación electrónica, aceptando que el contenido formará parte integrante de la relación contractual.",
    },
    {
      tipo: "texto",
      texto:
        `CUARTA. Renta. El Subarrendatario se compromete y obliga para con el Subarrendador, o a quien sus derechos represente, a pagarle por el uso y goce temporal del Inmueble la cantidad mensual de ${b(d.dinero("condiciones", "rentaMensual"))} más el correspondiente Impuesto al Valor Agregado (I.V.A.) la (“Renta”), más la cuota de mantenimiento, la cual asciende al ${b(d.t("condiciones", "porcentajeMantenimiento"))}% del valor de la Renta más su correspondiente I.V.A., a partir de la Fecha de Entrega y hasta la total desocupación y entrega del Inmueble al Subarrendador.`,
    },
    {
      tipo: "texto",
      texto:
        `El Subarrendatario se obliga en este acto a cumplir puntual y oportunamente con el pago de la Renta en favor del Subarrendador, mismo que se deberá cubrir en moneda nacional, en cada mes calendario por concepto de mensualidades adelantadas, con fecha límite los días ${b(d.t("condiciones", "diaLimitePago"))} de cada mes.`,
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario estará obligado a cubrir el monto total de la Renta mensual pagadera de conformidad con los términos establecidos en el presente Contrato, sin importar si la ocupación no fuere por todo el mes natural.",
    },
    {
      tipo: "texto",
      texto:
        "En caso de que el Subarrendatario no pague la Renta en la forma establecida, o que incurra en mora acepta el pago de los intereses moratorios, sin perjuicio del derecho del Subarrendador de solicitar la desocupación del Inmueble mediante la rescisión del Contrato sin responsabilidad alguna, ni necesidad de declaración judicial previa.",
    },
    {
      tipo: "texto",
      texto:
        `QUINTA. Forma de pago. Las Partes acuerdan que el pago de la renta se realizará en una sola exhibición, cada mes natural y en la fecha pactada por cualquiera de los siguientes mecanismos de pago: (i) transferencia electrónica de fondos inmediatamente disponibles, o (ii) depósito en ventanilla bancaria a la cuenta bancaria que se señala a continuación: BENEFICIARIO: ${b(d.t("pago", "beneficiario"))}. INSTITUCIÓN BANCARIA: ${b(d.t("pago", "banco"))}. CLABE INTERBANCARIA: ${b(d.t("pago", "clabe"))}.`,
    },
    {
      tipo: "texto",
      texto:
        "Si por causa debidamente justificada el Subarrendatario no lograra realizar el pago de la Renta en la forma de pago señalada, el Subarrendatario se obliga a realizar el pago de la Renta de forma directa al Subarrendador en alguno de los domicilios señalados en sus declaraciones.",
    },
    {
      tipo: "texto",
      texto:
        `SEXTA. Intereses moratorios. El Subarrendatario acepta que, en caso de no efectuar el pago de la Renta en el plazo establecido, incurrirá en mora a partir del día siguiente, obligándose a pagar por concepto de intereses moratorios una tasa diaria del ${b(d.t("condiciones", "tasaMoratoriaDiaria"))}% sobre la cantidad adeudada, hasta alcanzar un tope máximo del ${b(d.t("condiciones", "topeMoratorioMensual"))}% mensual. El Subarrendatario acepta que cualquier pago que reciba el Subarrendador será aplicado primero a los intereses moratorios generados hasta la fecha del pago y el remanente al adeudo de la Renta.`,
    },
    {
      tipo: "texto",
      texto:
        "Las Partes convienen que el incumplimiento en las obligaciones de pago por parte del Subarrendatario constituye causal de rescisión del presente Contrato y el Subarrendatario deberá entregar la posesión del Inmueble sin necesidad de declaración judicial previa.",
    },
    {
      tipo: "texto",
      texto:
        `SÉPTIMA. Vigencia. La vigencia de este Contrato será de ${b(d.t("condiciones", "vigenciaMeses"))} meses forzosos para ambas Partes, contados a partir del día ${b(d.fecha("condiciones", "fechaInicioVigencia"))} (el “Plazo Forzoso”).`,
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario deberá realizar la desocupación y entrega del Inmueble al Subarrendador al día siguiente natural a la terminación de la vigencia del Subarrendamiento. En caso de que el Subarrendatario continúe con la ocupación y/o uso del Inmueble una vez terminado el Plazo Forzoso del Contrato, sin acuerdo previo y por escrito con el Subarrendador, no se entenderá como una renovación automática o prórroga adicional al Subarrendamiento.",
    },
    {
      tipo: "texto",
      texto:
        `Al término de la vigencia del presente Contrato, el Subarrendatario tendrá derecho preferente para solicitar la renovación o prórroga del presente Contrato por un periodo adicional y sucesivo de hasta máximo ${b(d.t("condiciones", "mesesRenovacionMax"))} meses, siempre que (i) se encuentre al corriente de todas y cada una de las obligaciones contraídas en el presente Contrato y (ii) notifique por escrito al Subarrendador su deseo de prorrogar o renovar, dentro de los 60 (sesenta) días naturales previos a la terminación de la vigencia inicial del Contrato.`,
    },
    {
      tipo: "texto",
      texto:
        "En caso de que el Subarrendatario cumpla con las obligaciones establecidas en el presente Contrato, el Subarrendador deberá considerar preferentemente la renovación del mismo, salvo que exista una causa justificada para no otorgarla, incluyendo de manera enunciativa más no limitativa: (i) incumplimiento grave o esencial de las obligaciones asumidas por el Subarrendatario; (ii) existencia de adeudos pendientes por concepto de Renta, servicios, cuotas o cualquier otra cantidad derivada del presente Contrato; (iii) incumplimiento reiterado de obligaciones contractuales; (iv) afectaciones al Inmueble, al corporativo o a terceros imputables al Subarrendatario; o (v) cualquier otra causa objetiva que imposibilite la continuidad de la relación contractual.",
    },
    {
      tipo: "texto",
      texto:
        "Para tales efectos, la aceptación de prórroga o renovación por parte del Subarrendador deberá constar por escrito y notificarse dentro de los 15 (quince) días siguientes a la recepción de la solicitud correspondiente. Si el Subarrendador no emite respuesta a la solicitud del Subarrendatario, se entenderá que la prórroga o renovación ha sido rechazada.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario no gozará de ningún derecho de preferencia o por el tanto para el Subarrendamiento o compra del Inmueble, renunciando así a cualquier derecho a su favor establecido en el artículo 2447 y 2448-J del Código Civil Federal y sus correlativos para las demás entidades de la República Mexicana.",
    },
    {
      tipo: "texto",
      texto:
        "OCTAVA. Ajuste de Renta. El monto de la Renta mensual que se encuentre vigente, se ajustará cada período de 12 (doce) meses contados a partir de la fecha de inicio de vigencia del presente Contrato, de conformidad con el Índice Nacional de Precios al Consumidor (INPC) publicado en el Diario Oficial de la Federación, en caso de prórroga o renovación al presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "NOVENA. Subarrendamiento y cesión de derechos. El Subarrendatario no podrá subarrendar o ceder sus derechos y obligaciones sobre el Inmueble de forma total o parcial, salvo previa autorización expresa y por escrito del Subarrendador. La autorización correspondiente deberá solicitarse por escrito con al menos 30 (treinta) días naturales de anticipación a la fecha en que se intente ejecutar el subarrendamiento o cesión correspondiente. Quedará a discreción del Subarrendador otorgar su consentimiento. El incumplimiento de la presente cláusula será causal de rescisión.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA. Obras y reparaciones. Queda expresamente prohibido al Subarrendatario ejecutar sin consentimiento previo, expreso y por escrito del Subarrendador, obra o reparación alguna al Inmueble.",
    },
    {
      tipo: "texto",
      texto:
        "En caso de que el Subarrendador autorice obras y/o reparaciones, el Subarrendatario se obliga a realizarlas con materiales de primera calidad y de conformidad con los reglamentos de construcción aplicables. Las Partes aceptan que todas y cada una de las obras y/o mejoras que lleve a cabo el Subarrendatario en el Inmueble quedarán a beneficio del Inmueble, sin que el Subarrendador tenga obligación alguna de pagar al Subarrendatario indemnización o compensación alguna.",
    },
    {
      tipo: "texto",
      texto:
        "No obstante lo anterior, el Subarrendatario podrá retirar, al término de la relación contractual y previo a la entrega del Inmueble, el mobiliario, equipos, elementos de decoración y cualquier otro bien desmontable que haya sido instalado por el propio Subarrendatario, siempre que dicho retiro no cause daños al Inmueble y se realice dejando el mismo en las condiciones en que fue recibido, salvo pacto distinto entre las Partes.",
    },
    {
      tipo: "texto",
      texto:
        "Las Partes acuerdan que no podrán ser retirados los pisos, lavabos, sanitarios (WC) ni aquellos elementos que, por su naturaleza, se encuentren incorporados de manera permanente al Inmueble, los cuales permanecerán en beneficio del mismo y deberán ser entregados al Subarrendador al término de la relación contractual. El Subarrendatario deberá presentar al Subarrendador, para su revisión y aprobación previa por escrito, cualquier proyecto de adecuaciones, remodelaciones, modificaciones, instalaciones o mejoras que pretenda realizar en el Inmueble. Ninguna obra o adecuación podrá iniciarse sin contar con la autorización expresa y por escrito del Subarrendador.",
    },
    {
      tipo: "texto",
      texto:
        "Las luminarias, lámparas o cualquier otro elemento de iluminación que el Subarrendatario instale o sustituya en el Inmueble quedarán adheridos al mismo y pasarán a formar parte del Inmueble, por lo que no podrán ser retirados al término de la vigencia del presente Contrato, salvo autorización previa y por escrito del Subarrendador.",
    },
    {
      tipo: "texto",
      texto:
        "Asimismo, cualquier anuncio, publicidad, letrero, vinil, logotipo o cualquier otro elemento publicitario que el Subarrendatario pretenda colocar, adherir o instalar en el Inmueble deberá contar previamente con la autorización expresa y por escrito del Subarrendador. Al concluir el subarrendamiento, o cuando dichos elementos sean retirados, el Subarrendatario deberá removerlos por completo, reparar cualquier daño ocasionado con motivo de su instalación o retiro y restituir las superficies afectadas al estado en que le fueron entregadas, considerando únicamente el desgaste natural derivado del uso ordinario.",
    },
    {
      tipo: "texto",
      texto:
        "Es obligación del Subarrendatario llevar a cabo todas y cada una de las reparaciones menores que requiera el Inmueble por causa del desgaste natural, incluyendo de manera enunciativa más no limitativa: plomería menor, cambios de focos, bisagras, rayones y golpes en muros, daños a persianas, limpieza general, daños por uso y/o negligencia. El Subarrendatario deberá notificar por escrito al Subarrendador de cualquier reparación antes de realizarla, para contar con su autorización.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendador será responsable de aquellas reparaciones mayores que sean necesarias en vista de deficiencias de habitabilidad del Inmueble, incluyendo de manera enunciativa más no limitativa: fallas estructurales, instalación general eléctrica, hidráulica y de gas, goteras, impermeabilización, inundaciones. El Subarrendatario deberá dar aviso inmediato por escrito al Subarrendador de cualquier reparación mayor necesaria, a fin de que el Subarrendador efectúe dicha reparación.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA PRIMERA. Vicios ocultos. El Subarrendatario no será responsable por los vicios ocultos que se encuentren en el Inmueble. En caso de presentarse vicios ocultos, el Subarrendatario deberá notificar dichos vicios por escrito al Subarrendador dentro de los primeros 30 (treinta) días naturales a partir del inicio de la vigencia del presente Contrato. El Subarrendador deberá realizar las reparaciones pertinentes al Inmueble en un plazo no mayor a 30 (treinta) días naturales. En caso contrario el Subarrendatario podrá rescindir el Contrato sin penalización alguna.",
    },
    {
      tipo: "texto",
      texto:
        `DÉCIMA SEGUNDA. Depósito. El Subarrendatario entrega al Subarrendador a la firma del presente Contrato, la cantidad de ${b(d.dinero("condiciones", "deposito"))} (el “Depósito”) como garantía para responder por el cumplimiento de las obligaciones previstas en este, incluyendo el estado y adeudos del Inmueble, e intereses moratorios generados por la mora en el pago de la Renta.`,
    },
    {
      tipo: "texto",
      texto:
        `El Subarrendador devolverá dicho Depósito dentro de los ${b(d.t("condiciones", "diasDevolucionDeposito"))} días naturales siguientes a la desocupación del Inmueble, siempre y cuando no existan cantidades pendientes de pago y el Subarrendatario haya cumplido con las obligaciones a su cargo en el presente Contrato, incluyendo la devolución del Inmueble en el estado en que lo recibió, salvo por el desgaste normal por el buen uso. En caso contrario, el Subarrendador podrá retener el Depósito para realizar las reparaciones necesarias y cubrir los adeudos de que se trate, sin perjuicio de la obligación del Subarrendatario de pagar al Subarrendador cualesquiera cantidades adicionales que no lleguen a cubrirse con el Depósito en garantía.`,
    },
    {
      tipo: "texto",
      texto:
        "Las Partes convienen que el Subarrendatario no podrá aplicar el Depósito como pago de la última mensualidad por concepto de Renta.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA TERCERA. Rescisión. Sin perjuicio de lo establecido en el contenido del presente instrumento, las Partes tendrán la facultad de dar por rescindido el presente Contrato con efectos inmediatos, sin responsabilidad y sin necesidad de declaración judicial previa (“Pacto Comisorio Expreso”), cuando se suscite cualquiera de las siguientes circunstancias:",
    },
    {
      tipo: "texto",
      texto:
        "A. En caso de incumplimiento a cualquiera de sus obligaciones pactadas en el Contrato. B. Cuando se trate de daños o reparaciones al Inmueble y/o fuera de este, estos deberán subsanarse o restaurarse en un plazo no mayor a 30 (treinta) días naturales. La parte afectada deberá notificar dicha situación a la parte en incumplimiento. C. El incumplimiento en una o más mensualidades respecto al pago de la Renta. D. La variación del uso convenido para el cual será destinado el Inmueble. E. La existencia de cualquier causa de extinción de dominio en términos de la Ley Nacional de Extinción de Dominio. F. La comisión de cualesquiera actos ilícitos por parte del Subarrendatario, dentro o fuera del Inmueble, siempre que se inicie una carpeta de investigación en su contra. G. El incumplimiento al Reglamento, normas y/o disposiciones sujetas al Inmueble. H. En caso de abandono al Inmueble, debidamente acreditado. I. La no localización del Subarrendatario, acreditada a través de medio fehaciente.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario podrá rescindir el presente Contrato, sin responsabilidad alguna para él, cuando el Subarrendador incurra en cualquiera de las siguientes causales: A. En caso de que el uso de suelo para el que se encuentra autorizado el Inmueble sufra alguna modificación, sin notificación o conocimiento previo por parte del Subarrendatario. B. En caso de que el Inmueble sea clausurado, cerrado o fuere impedido total o parcialmente su uso por cualquier autoridad por causas directamente imputables al Subarrendador.",
    },
    {
      tipo: "texto",
      texto:
        `DÉCIMA CUARTA. Pena Convencional. En caso de que alguna de las Partes incumpla con cualquiera de las obligaciones a su cargo que deriven en una causal de rescisión o termine de manera anticipada la relación contractual, estará obligado a pagar por concepto de Pena Convencional, la cantidad total de ${b(d.dinero("condiciones", "penaConvencional"))} (la “Pena Convencional”).`,
    },
    {
      tipo: "texto",
      texto:
        "En caso de terminación anticipada, la parte que solicite la culminación del Subarrendamiento deberá estar al corriente en todas y cada una de las obligaciones contraídas en el presente Contrato, así como notificarlo por escrito con al menos 30 (treinta) días de anticipación a la contraparte y cubrir el pago por concepto de pena convencional.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA QUINTA. Servicios. Es obligación del Subarrendatario pagar por su cuenta y de manera puntual todos los servicios que utilice o contrate para su uso dentro del Inmueble. El pago de dichos servicios será exclusiva responsabilidad del Subarrendatario, quien no podrá, en ningún caso, solicitar el cambio de titularidad de los recibos de agua potable, energía eléctrica, gas o cualquier otro servicio que se encuentre a nombre del Subarrendador, salvo autorización previa y por escrito otorgada por éste.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendador podrá solicitar mensual o bimestralmente al Subarrendatario los comprobantes de pago de los servicios correspondientes al Inmueble, y el Subarrendatario deberá proporcionarlos dentro de los treinta (30) días naturales siguientes a la fecha en que le sean requeridos.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario se obliga a indemnizar y sacar en paz y a salvo al Subarrendador de cualquier adeudo, reclamación o juicio que se interponga en su contra derivado de la falta de pago en que incurra el Subarrendatario, así como a reembolsar cualquier cantidad que éste llegue a cubrir como consecuencia de dicho adeudo, reclamación o juicio, incluyendo, sin limitar, honorarios y costas judiciales.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA SEXTA. Reglamento. El Subarrendatario manifiesta conocer y estar de acuerdo con el reglamento aplicable al Inmueble, obligándose a cumplirlo y a hacer que lo cumpla cualquier persona que lo visite. Asimismo, se compromete a observar todas las disposiciones, horarios y condiciones establecidas para el Inmueble en razón de su giro, así como aquellas que emita internamente el Subarrendador y/o la administración del Inmueble.",
    },
    {
      tipo: "texto",
      texto:
        `DÉCIMA SÉPTIMA. Operación del giro comercial. El Subarrendador manifiesta y garantiza que, conforme a la información y documentación que tiene en su poder, el Inmueble, su uso de suelo, instalaciones y características son compatibles con el destino pactado en el presente Contrato para la operación de ${destino}; sin que lo anterior implique una garantía respecto del otorgamiento de autorizaciones, licencias o permisos cuya expedición corresponda a las autoridades competentes.`,
    },
    {
      tipo: "texto",
      texto:
        "En caso de que alguna autoridad niegue las autorizaciones necesarias para la operación del giro pactado por causas preexistentes imputables al Inmueble o al Subarrendador, el Subarrendatario podrá dar por terminado el presente Contrato sin penalización alguna, debiendo el Subarrendador devolver las cantidades efectivamente recibidas por concepto de depósito en garantía y pagos anticipados que, en su caso, correspondan.",
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario es responsable exclusivo de obtener, renovar y mantener todos los permisos y licencias necesarios para operar el Inmueble conforme al destino pactado. Por su parte, el Subarrendador se obliga a entregar la documentación que obre en su poder y que sea necesaria para dicho trámite.",
    },
    {
      tipo: "texto",
      texto:
        "La falta, vencimiento o revocación de cualquier permiso por causas imputables al Subarrendatario no suspende ni justifica el incumplimiento en el pago de la Renta, ni constituye causa de rescisión del Contrato. Lo anterior aplica incluso en caso de clausura total o parcial del Inmueble por parte de las autoridades.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA OCTAVA. Impuestos. Todos los impuestos, derechos y contribuciones fiscales que se generen o deriven con motivo de la celebración, ejecución o cumplimiento del presente Contrato serán responsabilidad exclusiva de la parte a la que corresponda, conforme a las leyes fiscales aplicables.",
    },
    {
      tipo: "texto",
      texto:
        "DÉCIMA NOVENA. Multas y sanciones. El Subarrendatario será responsable de todas las multas, clausuras o cualquier sanción administrativa derivadas de la operación atribuida al giro y/o actividades del cliente, que se imponga al Inmueble. Asimismo, el Subarrendatario deberá realizar todos los trámites necesarios para levantar cualquier estado de clausura, suspensión, sanción o para efectuar el pago de la infracción correspondiente, obligándose a sacar en paz y a salvo al Subarrendador de cualquier procedimiento en el que éste pudiera verse involucrado con motivo de dichas sanciones.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA. Establecimiento. El Subarrendatario se obliga a dar cumplimiento con las siguientes condiciones: A. Cumplir con la normativa de establecimientos mercantiles aplicable, así como con las demás normas jurídicas aplicables a la materia del presente Contrato. B. Aplicar las prevenciones y medidas de seguridad, sanitarias, ambientales, de protección civil o de cualquier otra naturaleza, que determinen o expidan las autoridades competentes, en relación a su giro o actividades, conjuntamente con las que internamente establezca el Subarrendador. C. Observar y cumplir con todos y cada uno de los reglamentos de horarios y servicios emitidos por las autoridades competentes, el Subarrendador y/o administración del Inmueble. D. Mantener en todo momento el local del Inmueble y los bienes incorporados al mismo, en buen estado de uso, conservando las características que éstos tengan en el momento de apertura del establecimiento y sin poder modificarlos, salvo previa autorización por escrito del Subarrendador. E. No instalar cualquier objeto en el exterior del local del Inmueble, ni en las áreas o pasillos comunes, salvo con la autorización previa y por escrito del Subarrendador. F. El sonido de los aparatos autorizados o que funcionen en el interior del local del Inmueble no deberá rebasar los niveles de ruido permitidos. G. Sujetarse a la normatividad vigente en materia de anuncios, iluminación, emisión de ruido, prevención de siniestros y uso de las áreas comunes. H. Conservar la basura y desperdicios generados en el local del Inmueble en los espacios destinados para tales efectos. I. Mantener y propiciar la paz y la armonía con cualquier persona que se encuentre en el local del Inmueble.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA PRIMERA. Protección de arrendamiento. A la firma del presente instrumento, el Subarrendador podrá celebrar un contrato de prestación de servicios de protección de arrendamiento conforme a los términos y condiciones establecidos en dicho contrato. El Subarrendatario acepta que el referido contrato deberá renovarse anualmente, o en su caso, sustituirse por otro mecanismo de protección equivalente, a satisfacción del Subarrendador, durante la vigencia de la relación contractual.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA SEGUNDA. Responsabilidad civil y siniestros. El Subarrendador, en ningún caso y por ningún motivo será responsable de los daños, pérdidas, robos o cualquier otra eventualidad que afecte los bienes que el Subarrendatario introduzca o utilice dentro del Inmueble, ni de aquellos pertenecientes a terceros que se encuentren en el mismo. Asimismo, el Subarrendador no asumirá responsabilidad alguna por lesiones o daños a personas y/o bienes que se hallen dentro del Inmueble, ocasionados por explosiones, desprendimientos de materiales, vapor, gas, electricidad, agua, lluvia, fugas en tuberías, aparatos o instalaciones hidráulicas o sanitarias, sismos, temblores, inundaciones o por cualquier otra causa.",
    },
    {
      tipo: "texto",
      texto:
        "Los daños ocasionados al Inmueble o a los predios colindantes, derivados de siniestros originados por culpa, negligencia o mal uso por parte del Subarrendatario, ocupantes o de quienes lo visiten por cualquier motivo, serán de exclusiva responsabilidad del Subarrendatario, quien se obliga a reparar y/o indemnizar los perjuicios que de ello resulten.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA TERCERA. Indemnizaciones. Las Partes reconocen y aceptan en este acto de manera expresa, incondicional e irrevocable, para todos los efectos legales a que haya lugar, que el Subarrendatario conviene en indemnizar y sacar en paz y a salvo al Subarrendador, por cualquier pérdida, responsabilidad, daño, perjuicio, reclamación, gasto, obligación, sanción, acción, sentencia, demanda, costo o erogación, incluyendo de manera enunciativa más no limitativa, honorarios razonables y gastos incurridos, que resulten de: (i) cualquier incumplimiento a cualesquiera de las obligaciones a su cargo establecidas en el presente Contrato; y/o (ii) falsedad o imprecisión de cualesquiera de las declaraciones otorgadas por el Subarrendatario en términos del presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA CUARTA. Notificaciones. Todas las notificaciones realizadas bajo este Contrato deberán ser entregadas por escrito y en forma personal con acuse de recibo o mediante fedatario público, en los domicilios respectivos indicados en el capítulo de declaraciones del presente Contrato y/o mediante correo electrónico a las direcciones que se establecen en las declaraciones.",
    },
    {
      tipo: "texto",
      texto:
        "Las Partes están obligadas a notificar inmediatamente y por escrito cualquier cambio en sus domicilios físicos o cuentas de mensajería electrónica durante la vigencia del presente Contrato, en el entendido de que hasta en tanto no se realice alguna notificación, el domicilio y correo electrónico previamente establecido será válido para los propósitos indicados en la presente cláusula.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA QUINTA. Acuerdo total. El presente Contrato constituye el acuerdo integral entre las Partes con relación al objeto del mismo y sustituye cualquier comunicación verbal o escrita anterior en relación con dicho objeto.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA SEXTA. Confidencialidad. Las Partes se obligan a mantener estricta confidencialidad respecto de toda la información, documentación y, en general, cualquier elemento que sea revelado o al que tengan acceso con motivo de la celebración de este Contrato y que haya sido compartida entre ellas. Dicha información no podrá ser divulgada a terceros sin el consentimiento previo y por escrito de la Parte que la haya proporcionado, salvo disposición legal o mandato de autoridad competente.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA SÉPTIMA. Supletoriedad y jurisdicción. Para la interpretación, cumplimiento y ejecución del presente Contrato, las Partes acuerdan intentar previamente y de forma voluntaria un mecanismo de mediación como medio alternativo de solución de controversias. De no resolverse por dicha vía, se someten expresamente a la jurisdicción de los tribunales competentes del domicilio del Inmueble, renunciando a cualquier otro fuero que pudiera corresponderles por razón de su domicilio presente o futuro. En todo lo no previsto, será aplicable supletoriamente el Código Civil Federal y sus disposiciones correlativas aplicables en las demás entidades de la República Mexicana.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA OCTAVA. Extinción de dominio. El Subarrendatario se obliga a abstenerse de realizar, o permitir que cualquier ocupante y/o visitante realice, dentro del Inmueble o en las zonas aledañas, cualquier acto ilícito tipificado en la Ley Nacional de Extinción de Dominio, en el Código Penal del fuero común o federal, en el artículo 22 de la Constitución Política de los Estados Unidos Mexicanos, así como en cualquier otra ley o disposición legal aplicable.",
    },
    {
      tipo: "texto",
      texto:
        "En caso de que el Inmueble sea clausurado, intervenido, asegurado, expropiado, sellado o limitado en su uso, total o parcialmente, por causas atribuibles al Subarrendatario, ocupantes o visitantes, derivado de la violación de leyes, omisión en el pago de impuestos o la realización de actos ilícitos conforme a lo dispuesto en la Ley Nacional de Extinción de Dominio y demás legislación aplicable, el Subarrendatario se obliga a reembolsar de inmediato al Subarrendador, que de manera enunciativa más no limitativa, los honorarios, gastos, asesorías y demás pagos,",
    },
    {
      tipo: "texto",
      texto:
        "que éste deba efectuar para liberar el Inmueble y recuperar su entrega, aun cuando dichas circunstancias se produzcan con posterioridad a la desocupación del Inmueble, así como a pagar los daños y perjuicios ocasionados, continuar cubriendo íntegramente el importe de la renta pactada, y sacar en paz y a salvo al Subarrendador de cualquier responsabilidad derivada de tales hechos.",
    },
    {
      tipo: "texto",
      texto:
        "VIGÉSIMA NOVENA. Caso fortuito o fuerza mayor. Si por caso fortuito o fuerza mayor se imposibilita el uso continuo y/o total del Inmueble al Subarrendatario, no se causará Renta en dicho periodo. Si la situación dura más de 2 (dos) meses, cualquiera de las Partes podrá solicitar la rescisión del Contrato, esto sin responsabilidad, penalización o perjuicio alguno, de conformidad con lo dispuesto en los artículos 2431 y 2432 del Código Civil Federal y sus correlativos para las demás entidades de la República Mexicana.",
    },
    {
      tipo: "texto",
      texto:
        "TRIGÉSIMA. Obligación solidaria. El Obligado Solidario garantiza, de manera solidaria, irrevocable, absoluta e incondicional al Subarrendador, el cumplimiento total de todas y cada una de las obligaciones a cargo del Subarrendatario conforme al presente Contrato, incluyendo, sin limitar, las obligaciones de pago, intereses, penalizaciones y cualquier otra que derive de este instrumento durante su vigencia. La obligación solidaria únicamente se extinguirá cuando el Subarrendatario haya cumplido íntegra y satisfactoriamente con todas las obligaciones asumidas, a satisfacción del Subarrendador.",
    },
    {
      tipo: "texto",
      texto:
        "El Obligado Solidario renuncia de manera expresa, irrevocable e incondicional a oponer cualquier excepción, defensa o derecho que pudiera corresponderle en contra de la cobranza ejercida por el Subarrendador. En caso de que el Obligado Solidario efectúe pagos en nombre o por cuenta del Subarrendatario, dichos pagos se considerarán realizados para cumplir las obligaciones de este último, y no liberarán al Obligado Solidario de continuar garantizando el cumplimiento íntegro de todas las obligaciones del Subarrendatario bajo este Contrato.",
    },
    {
      tipo: "texto",
      texto:
        `TRIGÉSIMA PRIMERA. Cajón de estacionamiento. El arrendamiento del Inmueble incluye ${b(d.t("extras", "cajonesEstacionamiento"))} lugar(es) de estacionamiento. El Subarrendatario deberá ocupar únicamente el espacio que esté asignado al Inmueble, brindando en todo momento las facilidades necesarias a fin de permitir la circulación de los demás; cualquier práctica en contrario ocasionará las multas y/o las acciones legales que determine el condominio. El Subarrendador no es responsable de los daños que sufra el vehículo del Subarrendatario en el estacionamiento ni de la seguridad del mismo o de los objetos que deje en su interior.`,
    },
    {
      tipo: "texto",
      texto:
        `TRIGÉSIMA SEGUNDA. Exclusividad del giro. Las Partes acuerdan que, durante la vigencia del presente Contrato, el Subarrendador no podrá autorizar, permitir ni celebrar contrato alguno con terceros cuyo objeto sea la instalación, operación o funcionamiento de otro establecimiento del giro ${b(d.t("extras", "exclusividadGiro"))} o con características sustancialmente similares dentro de ${corp}.`,
    },
    {
      tipo: "texto",
      texto:
        `La presente exclusividad se limita única y exclusivamente al giro señalado, por lo que no será aplicable a otros establecimientos comerciales o puntos de venta que no tengan dicho objeto.`,
    },
    {
      tipo: "texto",
      texto:
        `TRIGÉSIMA TERCERA. Anuncios. El Subarrendatario podrá colocar anuncios, letreros, elementos de identificación comercial y/o publicidad relacionada con la operación de ${destino}, siempre y cuando cuente previamente con la autorización del Subarrendador y cumpla con los lineamientos, reglamentos internos y criterios de imagen establecidos para ${corp}.`,
    },
    {
      tipo: "texto",
      texto:
        `Los anuncios, letreros o elementos publicitarios deberán mantener la misma línea estética, diseño, materiales, dimensiones, colores y características de los anuncios autorizados para los establecimientos ubicados dentro de ${corp}. En ningún caso podrán instalarse anuncios con luces de neón, iluminación excesiva, colores estridentes, elementos que alteren la imagen arquitectónica o cualquier otro elemento que no sea acorde con la imagen comercial del corporativo.`,
    },
    {
      tipo: "texto",
      texto:
        `El Subarrendatario será responsable de obtener, a su costa, las autorizaciones, permisos y/o licencias que resulten necesarios para la instalación y permanencia de dichos anuncios, así como de cumplir con cualquier disposición aplicable emitida por las autoridades competentes y/o por la administración de ${corp}. Al término del presente Contrato, el Subarrendatario deberá retirar los anuncios, letreros y elementos publicitarios instalados por su cuenta, dejando el área correspondiente en las mismas condiciones en que le fue entregada, salvo que el Subarrendador autorice expresamente lo contrario.`,
    },
    {
      tipo: "texto",
      texto:
        `TRIGÉSIMA CUARTA. Permiso de uso de terraza. El Subarrendador autoriza al Subarrendatario, durante la vigencia del presente Contrato, el uso no exclusivo de la(s) área(s) de terraza de ${corp} que, en su caso, sean asignadas o permitidas por la administración correspondiente, únicamente como área complementaria y accesoria para la operación del giro de ${destino}, quedando entendido que dicho uso estará sujeto en todo momento a: a) la obtención y conservación, por cuenta y cargo del Subarrendatario, de todas las licencias, permisos y autorizaciones que resulten aplicables, incluyendo en materia de funcionamiento, protección civil, salubridad y, en su caso, uso de área común; b) el cumplimiento del reglamento, lineamientos, horarios, medidas de seguridad y políticas de operación y de imagen que emita la administración de ${corp} y/o el Subarrendador; c) la prohibición de ejecutar obras, instalaciones fijas, perforaciones, conexiones, anclajes o modificaciones en dicha terraza sin autorización previa, expresa y por escrito del Subarrendador y, en su caso, de la administración; y d) el uso cuidadoso y ordenado de la terraza, procurando en todo momento causar la menor afectación posible a terceros, a áreas comunes y a la operación del inmueble.`,
    },
    {
      tipo: "texto",
      texto:
        "El Subarrendatario será responsable frente al Subarrendador por cualquier daño, menoscabo, afectación, reclamación, multa o sanción que derive del uso de la terraza por el propio Subarrendatario, sus empleados, proveedores, contratistas, clientes y/o visitantes, obligándose a sacar en paz y a salvo al Subarrendador de cualquier reclamación relacionada. Las Partes acuerdan que la presente autorización no confiere derecho real alguno, ni posesión sobre la terraza, y podrá quedar sin efectos en caso de que la autoridad competente o la administración restrinja o prohíba dicho uso por causas no imputables al Subarrendador; en tal supuesto, el Subarrendatario deberá ajustarse de inmediato a dicha determinación sin que ello implique, por sí mismo, modificación a la Renta ni a las demás obligaciones de pago previstas en el presente Contrato.",
    },
    {
      tipo: "texto",
      texto:
        "Asimismo, se hace constar que esta autorización: (i) está condicionada a que exista la autorización previa y por escrito del arrendador o propietario conforme al contrato de arrendamiento principal; (ii) no modifica ni sustituye las disposiciones de uso de suelo aplicables ni surte efectos frente a autoridad alguna; y (iii) la vigencia de la presente autorización no podrá exceder la vigencia del contrato de arrendamiento principal.",
    },
    {
      tipo: "texto",
      texto:
        "TRIGÉSIMA QUINTA. Seguro. El Subarrendatario se obliga a contratar, a su propio costo y al momento de la firma del presente Contrato, un seguro de daños al Inmueble y de responsabilidad civil con la compañía de seguros que estimen conveniente las Partes, y a mantener dicha cobertura vigente durante todo el plazo del Contrato, así como durante sus renovaciones y/o extensiones. En caso de que el Subarrendatario incumpla con esta obligación, autoriza desde este momento al Subarrendador para realizar el pago correspondiente del seguro y descontar su costo del depósito entregado por el Subarrendatario a la firma del presente instrumento.",
    },
    {
      tipo: "texto",
      texto:
        "TRIGÉSIMA SEXTA. Firma electrónica. Las Partes manifiestan su consentimiento expreso de forma digital en el presente instrumento, existente a través de su firma; mismo que no se vio influenciado por ningún vicio que pudiera nulificar en todo o en parte, de conformidad con el artículo 1803 del Código Civil Federal.",
    },
    {
      tipo: "texto",
      texto:
        `Leído que fue por las Partes el presente instrumento y enteradas de su alcance y fuerza legal, lo suscriben de forma digital, con fecha de inicio de vigencia el día ${b(d.fecha("condiciones", "fechaInicioVigencia"))}.`,
    },
    { tipo: "seccion", texto: "FIRMAS" },
    {
      tipo: "texto",
      texto:
        `SUBARRENDADOR\n${b(d.t("subarrendador", "razonSocial"))}\nRepresentado en este acto por:\n${b(d.t("subarrendador", "representante"))}`,
    },
    {
      tipo: "texto",
      texto: `SUBARRENDATARIO\n${b(d.t("subarrendatario", "nombre"))}\nPor propio derecho`,
    },
    {
      tipo: "texto",
      texto: `OBLIGADO SOLIDARIO\n${b(d.t("obligadoSolidario", "nombre"))}\nPor propio derecho`,
    },
  ]);
}
