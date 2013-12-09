// A collection of SVG paths to generate vector icons on the fly
// Written by Andres Veidenberg //andres.veidenberg{at}helsinki.fi//, University of Helsinki [2012]

function svgicon(type,options){
	var paths = {
		trash: 'M20.826,5.75l0.396,1.188c1.54,0.575,2.589,1.44,2.589,2.626c0,2.405-4.308,3.498-8.312,3.498c-4.003,0-8.311-1.093-8.311-3.498c0-1.272,1.21-2.174,2.938-2.746l0.388-1.165c-2.443,0.648-4.327,1.876-4.327,3.91v2.264c0,1.224,0.685,2.155,1.759,2.845l0.396,9.265c0,1.381,3.274,2.5,7.312,2.5c4.038,0,7.313-1.119,7.313-2.5l0.405-9.493c0.885-0.664,1.438-1.521,1.438-2.617V9.562C24.812,7.625,23.101,6.42,20.826,5.75zM11.093,24.127c-0.476-0.286-1.022-0.846-1.166-1.237c-1.007-2.76-0.73-4.921-0.529-7.509c0.747,0.28,1.58,0.491,2.45,0.642c-0.216,2.658-0.43,4.923,0.003,7.828C11.916,24.278,11.567,24.411,11.093,24.127zM17.219,24.329c-0.019,0.445-0.691,0.856-1.517,0.856c-0.828,0-1.498-0.413-1.517-0.858c-0.126-2.996-0.032-5.322,0.068-8.039c0.418,0.022,0.835,0.037,1.246,0.037c0.543,0,1.097-0.02,1.651-0.059C17.251,18.994,17.346,21.325,17.219,24.329zM21.476,22.892c-0.143,0.392-0.69,0.95-1.165,1.235c-0.474,0.284-0.817,0.151-0.754-0.276c0.437-2.93,0.214-5.209-0.005-7.897c0.881-0.174,1.708-0.417,2.44-0.731C22.194,17.883,22.503,20.076,21.476,22.892zM11.338,9.512c0.525,0.173,1.092-0.109,1.268-0.633h-0.002l0.771-2.316h4.56l0.771,2.316c0.14,0.419,0.53,0.685,0.949,0.685c0.104,0,0.211-0.017,0.316-0.052c0.524-0.175,0.808-0.742,0.633-1.265l-1.002-3.001c-0.136-0.407-0.518-0.683-0.945-0.683h-6.002c-0.428,0-0.812,0.275-0.948,0.683l-1,2.999C10.532,8.77,10.815,9.337,11.338,9.512z',
		move: 'm 24.133853,13.490314 -7.796759,-0.01543 -0.02315,-7.3030908 1.888646,-0.0053 -3.153811,-5.1146393 -3.120827,5.1318383 1.867289,-0.0053 0.02362,7.2911038 -7.6808166,-0.01576 0.00454,-1.780734 -5.44103405,2.946758 5.42723725,2.968877 0.00454,-1.762513 7.6925124,0.0162 0.02284,7.206241 -1.887118,0.0058 3.153301,5.114161 3.121844,-5.131842 -1.869322,0.0053 -0.0228,-7.193775 7.784047,0.01595 -0.0045,1.780732 5.440525,-2.947235 -5.426224,-2.96984 z',
		view: 'M16,8.286C8.454,8.286,2.5,16,2.5,16s5.954,7.715,13.5,7.715c5.771,0,13.5-7.715,13.5-7.715S21.771,8.286,16,8.286zM16,20.807c-2.649,0-4.807-2.157-4.807-4.807s2.158-4.807,4.807-4.807s4.807,2.158,4.807,4.807S18.649,20.807,16,20.807zM16,13.194c-1.549,0-2.806,1.256-2.806,2.806c0,1.55,1.256,2.806,2.806,2.806c1.55,0,2.806-1.256,2.806-2.806C18.806,14.451,17.55,13.194,16,13.194z',
		hide: 'M11.478,17.568c-0.172-0.494-0.285-1.017-0.285-1.568c0-2.65,2.158-4.807,4.807-4.807c0.552,0,1.074,0.113,1.568,0.285l2.283-2.283C18.541,8.647,17.227,8.286,16,8.286C8.454,8.286,2.5,16,2.5,16s2.167,2.791,5.53,5.017L11.478,17.568zM23.518,11.185l-3.056,3.056c0.217,0.546,0.345,1.138,0.345,1.76c0,2.648-2.158,4.807-4.807,4.807c-0.622,0-1.213-0.128-1.76-0.345l-2.469,2.47c1.327,0.479,2.745,0.783,4.229,0.783c5.771,0,13.5-7.715,13.5-7.715S26.859,13.374,23.518,11.185zM25.542,4.917L4.855,25.604L6.27,27.02L26.956,6.332L25.542,4.917z',
		lower: 'm 16.286444,19.755113 c -1.893,-2.371 -3.815,-5.354 -6.009,-7.537 -1.4610005,-1.428 -3.1550005,-2.6640001 -5.3400005,-2.6930001 h -3.5 v 3.5000001 h 3.5 c 0.971,-0.119 2.845,1.333 4.712,3.771 1.8950005,2.371 3.8150005,5.354 6.0110005,7.537 1.326,1.297 2.847,2.426 4.751,2.645 v 2.646 l 7.556,-4.363 -7.556,-4.362 v 2.535 c -1.04,-0.339 -2.581,-1.663 -4.125,-3.679 z m -4.213975,-9.127222 7.556,-4.3609997 -7.556,-4.3620001 v 2.701 c -2.9290009,0.374 -4.9050009,2.6400001 -6.8090009,4.9520001 0.545,0.7029997 1.08,1.4179997 1.604,2.1269997 0.192,0.26 0.383,0.514 0.573,0.77 0.802,-1.043 1.584,-1.999 2.341,-2.7399997 0.8840009,-0.885 1.6730009,-1.393 2.2910009,-1.588 v 2.5009997 z',
		upper: 'm 16.332263,10.124423 c -1.893,2.371 -3.815,5.354 -6.009,7.537 -1.461001,1.428 -3.155001,2.664 -5.340001,2.693 h -3.5 v -3.5 h 3.5 c 0.971,0.119 2.845,-1.333 4.712,-3.771 1.895001,-2.371 3.815001,-5.3539995 6.011001,-7.5369995 1.326,-1.297 2.847,-2.426 4.751,-2.645 V 0.25542346 l 7.556,4.36300004 -7.556,4.3619998 V 6.4454235 c -1.04,0.339 -2.581,1.663 -4.125,3.6789995 z m -4.213975,9.127222 7.556,4.361 -7.556,4.362 v -2.701 c -2.9290014,-0.374 -4.9050014,-2.64 -6.8090014,-4.952 0.545,-0.703 1.08,-1.418 1.604,-2.127 0.192,-0.26 0.383,-0.514 0.573,-0.77 0.802,1.043 1.584,1.999 2.341,2.74 0.8840014,0.885 1.6730014,1.393 2.2910014,1.588 v -2.501 z',
		swap: 'M21.786,20.654c-0.618-0.195-1.407-0.703-2.291-1.587c-0.757-0.742-1.539-1.698-2.34-2.741c-0.191,0.256-0.382,0.51-0.574,0.77c-0.524,0.709-1.059,1.424-1.604,2.127c1.904,2.31,3.88,4.578,6.809,4.952v2.701l7.556-4.362l-7.556-4.362V20.654zM9.192,11.933c0.756,0.741,1.538,1.697,2.339,2.739c0.195-0.262,0.39-0.521,0.587-0.788c0.52-0.703,1.051-1.412,1.592-2.11c-2.032-2.463-4.133-4.907-7.396-5.025h-3.5v3.5h3.5C6.969,10.223,7.996,10.735,9.192,11.933zM21.786,10.341v2.535l7.556-4.363l-7.556-4.363v2.647c-1.904,0.219-3.425,1.348-4.751,2.644c-2.196,2.183-4.116,5.167-6.011,7.538c-1.867,2.438-3.741,3.888-4.712,3.771h-3.5v3.5h3.5c2.185-0.029,3.879-1.266,5.34-2.693c2.194-2.184,4.116-5.167,6.009-7.538C19.205,12.003,20.746,10.679,21.786,10.341z',
		children: 'M21.786,20.698c-1.792-0.237-2.912-1.331-4.358-2.886c-0.697-0.751-1.428-1.577-2.324-2.319c1.396-1.165,2.411-2.519,3.483-3.503c1.01-0.92,1.901-1.519,3.199-1.688v2.574l7.556-4.363L21.786,4.15v2.652c-3.34,0.266-5.45,2.378-6.934,4.013c-0.819,0.896-1.537,1.692-2.212,2.192c-0.685,0.501-1.227,0.731-2.013,0.742c-0.001,0-0.002,0-0.003,0H2.812v3.5h0.001v0.001c0,0,0.046-0.001,0.136-0.001h7.677c0.786,0.011,1.33,0.241,2.017,0.743c1.021,0.743,2.095,2.181,3.552,3.568c1.312,1.258,3.162,2.46,5.592,2.649v2.664l7.556-4.36l-7.556-4.361V20.698z',
		root: 'm 10.443278,18.371569 -4.3609998,-7.556 -4.362,7.556 2.701,0 c 0.374,2.929 2.64,4.905 4.952,6.809 0.7029998,-0.545 1.4179998,-1.08 2.1269998,-1.604 0.26,-0.192 0.514,-0.383 0.77,-0.573 -1.043,-0.802 -1.999,-1.584 -2.7399998,-2.341 -0.885,-0.884 -1.393,-1.673 -1.588,-2.291 l 2.5009998,0 z M 19.5705,13.9285 c -2.371,1.893 -5.354,3.815 -7.537,6.009 -1.428,1.461 -2.664,3.155 -2.693,5.34 l 0,3.5 3.5,0 0,-3.5 c -0.119,-0.971 1.333,-2.845 3.771,-4.712 2.371,-1.895 5.354,-3.815 7.537,-6.011 1.297,-1.326 2.426,-2.847 2.645,-4.751 l 2.646,0 -4.363,-7.556 -4.362,7.556 2.535,0 c -0.339,1.04 -1.663,2.581 -3.679,4.125 z m -2.712625,-3.80427 -4.361,-7.5560002 -4.362,7.5560002 2.701,0 c 0.374,2.929 2.64,4.905 4.952,6.809 0.703,-0.545 1.418,-1.08 2.127,-1.604 0.26,-0.192 0.514,-0.383 0.77,-0.573 -1.043,-0.802 -1.999,-1.584 -2.74,-2.341 -0.885,-0.884 -1.393,-1.673 -1.588,-2.291 l 2.501,0 z',
		tree: 'm 11.920931,9.975778 7.556,-4.3609999 -7.556,-4.362 0,2.701 c -2.929,0.374 -4.905,2.64 -6.809,4.952 0.545,0.7029999 1.08,1.4179999 1.604,2.1269999 0.192,0.26 0.383,0.514 0.573,0.77 0.802,-1.043 1.584,-1.999 2.341,-2.7399999 0.884,-0.885 1.673,-1.393 2.291,-1.588 l 0,2.5009999 z M 16.364,19.103 C 14.471,16.732 12.549,13.749 10.355,11.566 8.894,10.138 7.2,8.9019999 5.015,8.8729999 l -3.5,0 0,3.5000001 3.5,0 c 0.971,-0.119 2.845,1.333 4.712,3.771 1.895,2.371 3.815,5.354 6.011,7.537 1.326,1.297 2.847,2.426 4.751,2.645 l 0,2.646 7.556,-4.363 -7.556,-4.362 0,2.535 c -1.04,-0.339 -2.581,-1.663 -4.125,-3.679 z m 3.80427,-2.712625 7.556,-4.361 -7.556,-4.3620001 0,2.7010001 c -2.929,0.374 -4.905,2.64 -6.809,4.952 0.545,0.703 1.08,1.418 1.604,2.127 0.192,0.26 0.383,0.514 0.573,0.77 0.802,-1.043 1.584,-1.999 2.341,-2.74 0.884,-0.885 1.673,-1.393 2.291,-1.588 l 0,2.501 z',
		prune: 'm 19.562851,8.073736 0.03125,2.71875 c -2.882582,0.393185 -4.828834,2.614048 -6.6875,4.90625 -0.221506,-0.28835 -0.462009,-0.559778 -0.6875,-0.84375 l -2.6562499,2.28125 c 1.7932879,2.268757 3.6193419,4.978996 5.6874999,7 1.337057,1.285599 2.875445,2.39106 4.78125,2.59375 l 0.03125,2.65625 7.5,-4.4375 -7.59375,-4.28125 0.03125,2.53125 c -1.042873,-0.330081 -2.595045,-1.653544 -4.15625,-3.65625 -0.250648,-0.308484 -0.497657,-0.642447 -0.75,-0.96875 0.764461,-1.007755 1.525207,-1.934522 2.25,-2.65625 0.87639,-0.892537 1.633692,-1.424716 2.25,-1.625 l 0.03125,2.5 7.53125,-4.40625 -7.59375,-4.3125 z m -8.36868,-7.52352533 0.03125,2.71875003 c -2.911323,0.3971054 -4.8743904,2.6524548 -6.7499997,4.96875 -0.041426,-0.00107 -0.083225,1.967e-4 -0.125,0 l -3.49999995,0.03125 0.03125,3.4999993 3.49999995,-0.03125 c 0.5326396,-0.06991 1.3474214,0.347693 2.28125,1.125 l 2.65625,-2.3125 c -0.4208407,-0.381919 -0.8472931,-0.7770725 -1.3125,-1.0937495 0.324874,-0.3826572 0.6518381,-0.7469274 0.96875,-1.0624998 0.87639,-0.8925366 1.6649427,-1.4247156 2.2812497,-1.625 l 0.03125,2.5 7.5,-4.40625 -7.59375,-4.31250003 z',
		ancestral: 'm 15.386335,19.644173 c -1.429914,-0.237 -2.32361,-1.331 -3.477436,-2.886 -0.556166,-0.751 -1.139463,-1.577 -1.85442,-2.319 1.113929,-1.165 1.923841,-2.519 2.779236,-3.503 0.805923,-0.92 1.51689,-1.5189996 2.55262,-1.6879996 v 2.5739996 l 6.029259,-4.3629996 -6.029259,-4.363 v 2.652 c -2.66513,0.266 -4.34879,2.378 -5.5329375,4.013 -0.6535154,0.8959996 -1.2264386,1.6919996 -1.7650503,2.1919996 -0.5465912,0.501 -0.9790766,0.731 -1.60626,0.742 -7.979e-4,0 -0.0016,0 -0.00239,0 H 0.24616125 v 3.5 h 7.9794e-4 v 0.001 c 0,0 0.0367054,-0.001 0.10852029,-0.001 H 6.4812893 c 0.6271833,0.011 1.0612646,0.241 1.6094518,0.743 0.8146999,0.743 1.6716909,2.181 2.8342939,3.568 1.046902,1.258 2.523096,2.46 4.462098,2.649 v 2.664 l 6.029259,-4.36 -6.029259,-4.361 v 2.546 z m 6.995306,-0.811762 7.556,-4.363 -7.556,-4.363 v 2.598 H 3.4086411 v 3.5 H 22.381641 v 2.628 z',
		redo: 'M24.083,15.5c-0.009,4.739-3.844,8.574-8.583,8.583c-4.741-0.009-8.577-3.844-8.585-8.583c0.008-4.741,3.844-8.577,8.585-8.585c1.913,0,3.665,0.629,5.09,1.686l-1.782,1.783l8.429,2.256l-2.26-8.427l-1.89,1.89c-2.072-1.677-4.717-2.688-7.587-2.688C8.826,3.418,3.418,8.826,3.416,15.5C3.418,22.175,8.826,27.583,15.5,27.583S27.583,22.175,27.583,15.5H24.083z',
		undo: 'm 6.916,15.5 c 0.009,4.739 3.844,8.574 8.583,8.583 4.741,-0.009 8.577,-3.844 8.585,-8.583 -0.008,-4.741 -3.844,-8.577 -8.585,-8.585 -1.913,0 -3.665,0.629 -5.09,1.686 l 1.782,1.783 -8.429,2.256 2.26,-8.427 1.89,1.89 C 9.984,4.426 12.629,3.415 15.499,3.415 22.173,3.418 27.581,8.826 27.583,15.5 27.581,22.175 22.173,27.583 15.499,27.583 8.825,27.583 3.416,22.175 3.416,15.5 h 3.5 z',
		file: 'M23.024,5.673c-1.744-1.694-3.625-3.051-5.168-3.236c-0.084-0.012-0.171-0.019-0.263-0.021H7.438c-0.162,0-0.322,0.063-0.436,0.18C6.889,2.71,6.822,2.87,6.822,3.033v25.75c0,0.162,0.063,0.317,0.18,0.435c0.117,0.116,0.271,0.179,0.436,0.179h18.364c0.162,0,0.317-0.062,0.434-0.179c0.117-0.117,0.182-0.272,0.182-0.435V11.648C26.382,9.659,24.824,7.49,23.024,5.673zM25.184,28.164H8.052V3.646h9.542v0.002c0.416-0.025,0.775,0.386,1.05,1.326c0.25,0.895,0.313,2.062,0.312,2.871c0.002,0.593-0.027,0.991-0.027,0.991l-0.049,0.652l0.656,0.007c0.003,0,1.516,0.018,3,0.355c1.426,0.308,2.541,0.922,2.645,1.617c0.004,0.062,0.005,0.124,0.004,0.182V28.164z',
		edit: 'M13.587,12.074c-0.049-0.074-0.11-0.147-0.188-0.202c-0.333-0.243-0.803-0.169-1.047,0.166c-0.244,0.336-0.167,0.805,0.167,1.048c0.303,0.22,0.708,0.167,0.966-0.091l-7.086,9.768l-2.203,7.997l6.917-4.577L26.865,4.468l-4.716-3.42l-1.52,2.096c-0.087-0.349-0.281-0.676-0.596-0.907c-0.73-0.529-1.751-0.369-2.28,0.363C14.721,6.782,16.402,7.896,13.587,12.074zM10.118,25.148L6.56,27.503l1.133-4.117L10.118,25.148zM14.309,11.861c2.183-3.225,1.975-4.099,3.843-6.962c0.309,0.212,0.664,0.287,1.012,0.269L14.309,11.861z',
		gears: 'M17.41,20.395l-0.778-2.723c0.228-0.2,0.442-0.414,0.644-0.643l2.721,0.778c0.287-0.418,0.534-0.862,0.755-1.323l-2.025-1.96c0.097-0.288,0.181-0.581,0.241-0.883l2.729-0.684c0.02-0.252,0.039-0.505,0.039-0.763s-0.02-0.51-0.039-0.762l-2.729-0.684c-0.061-0.302-0.145-0.595-0.241-0.883l2.026-1.96c-0.222-0.46-0.469-0.905-0.756-1.323l-2.721,0.777c-0.201-0.228-0.416-0.442-0.644-0.643l0.778-2.722c-0.418-0.286-0.863-0.534-1.324-0.755l-1.96,2.026c-0.287-0.097-0.581-0.18-0.883-0.241l-0.683-2.73c-0.253-0.019-0.505-0.039-0.763-0.039s-0.51,0.02-0.762,0.039l-0.684,2.73c-0.302,0.061-0.595,0.144-0.883,0.241l-1.96-2.026C7.048,3.463,6.604,3.71,6.186,3.997l0.778,2.722C6.736,6.919,6.521,7.134,6.321,7.361L3.599,6.583C3.312,7.001,3.065,7.446,2.844,7.907l2.026,1.96c-0.096,0.288-0.18,0.581-0.241,0.883l-2.73,0.684c-0.019,0.252-0.039,0.505-0.039,0.762s0.02,0.51,0.039,0.763l2.73,0.684c0.061,0.302,0.145,0.595,0.241,0.883l-2.026,1.96c0.221,0.46,0.468,0.905,0.755,1.323l2.722-0.778c0.2,0.229,0.415,0.442,0.643,0.643l-0.778,2.723c0.418,0.286,0.863,0.533,1.323,0.755l1.96-2.026c0.288,0.097,0.581,0.181,0.883,0.241l0.684,2.729c0.252,0.02,0.505,0.039,0.763,0.039s0.51-0.02,0.763-0.039l0.683-2.729c0.302-0.061,0.596-0.145,0.883-0.241l1.96,2.026C16.547,20.928,16.992,20.681,17.41,20.395zM11.798,15.594c-1.877,0-3.399-1.522-3.399-3.399s1.522-3.398,3.399-3.398s3.398,1.521,3.398,3.398S13.675,15.594,11.798,15.594zM27.29,22.699c0.019-0.547-0.06-1.104-0.23-1.654l1.244-1.773c-0.188-0.35-0.4-0.682-0.641-0.984l-2.122,0.445c-0.428-0.364-0.915-0.648-1.436-0.851l-0.611-2.079c-0.386-0.068-0.777-0.105-1.173-0.106l-0.974,1.936c-0.279,0.054-0.558,0.128-0.832,0.233c-0.257,0.098-0.497,0.22-0.727,0.353L17.782,17.4c-0.297,0.262-0.568,0.545-0.813,0.852l0.907,1.968c-0.259,0.495-0.437,1.028-0.519,1.585l-1.891,1.06c0.019,0.388,0.076,0.776,0.164,1.165l2.104,0.519c0.231,0.524,0.541,0.993,0.916,1.393l-0.352,2.138c0.32,0.23,0.66,0.428,1.013,0.6l1.715-1.32c0.536,0.141,1.097,0.195,1.662,0.15l1.452,1.607c0.2-0.057,0.399-0.118,0.596-0.193c0.175-0.066,0.34-0.144,0.505-0.223l0.037-2.165c0.455-0.339,0.843-0.747,1.152-1.206l2.161-0.134c0.152-0.359,0.279-0.732,0.368-1.115L27.29,22.699zM23.127,24.706c-1.201,0.458-2.545-0.144-3.004-1.345s0.143-2.546,1.344-3.005c1.201-0.458,2.547,0.144,3.006,1.345C24.931,22.902,24.328,24.247,23.127,24.706z',
		settings: 'M26.834,14.693c1.816-2.088,2.181-4.938,1.193-7.334l-3.646,4.252l-3.594-0.699L19.596,7.45l3.637-4.242c-2.502-0.63-5.258,0.13-7.066,2.21c-1.907,2.193-2.219,5.229-1.039,7.693L5.624,24.04c-1.011,1.162-0.888,2.924,0.274,3.935c1.162,1.01,2.924,0.888,3.935-0.274l9.493-10.918C21.939,17.625,24.918,16.896,26.834,14.693z',
		info: 'm 15.018683,3.1391031 c 6.443587,0 11.659423,5.2579 11.659423,11.7561999 0,6.4971 -5.214784,11.7561 -11.659423,11.7561 -6.443445,0 -11.6594235,-5.2579 -11.6594235,-11.7561 0,-6.4970999 5.2146408,-11.7561999 11.6594235,-11.7561999 m 0,-2.83279997 c -7.9909904,0 -14.4689234,6.53159997 -14.4689234,14.58899987 0,8.0573 6.477933,14.5891 14.4689234,14.5891 7.990916,0 14.468923,-6.5318 14.468923,-14.5891 0,-8.0573999 -6.478007,-14.58899987 -14.468923,-14.58899987 l 0,0 z M 14.777487,23.096903 c -1.981396,0.702 -3.614841,-0.1026 -3.287183,-2.0216 0.327797,-1.9192 2.207982,-6.0276 2.476222,-6.8044 0.268024,-0.777 -0.245971,-0.9899 -0.796913,-0.6738 -0.317758,0.1848 -0.790033,0.5553 -1.195442,0.9153 -0.112448,-0.2281 -0.270557,-0.4891 -0.389259,-0.7387 0.661568,-0.6686 1.767455,-1.5648 3.076615,-1.8897 1.564185,-0.3893 4.178565,0.2331 3.05491,3.2478 -0.802397,2.1486 -1.369845,3.6313 -1.727421,4.7356 -0.357372,1.1047 0.06708,1.3363 0.692749,0.906 0.488785,-0.3366 1.009453,-0.7943 1.391125,-1.1493 0.176646,0.2893 0.233116,0.3817 0.407799,0.7141 -0.662552,0.6848 -2.395661,2.2873 -3.703202,2.7587 z M 18.882869,9.8053031 c -0.89869,0.7711999 -2.230744,0.7545999 -2.975963,-0.038 -0.745011,-0.7919 -0.620689,-2.0594 0.277789,-2.8307 0.898621,-0.7712 2.230955,-0.7546 2.975961,0.038 0.744941,0.7922 0.620759,2.0595 -0.277787,2.8312 z',
		mask: 'm 1.0561798,1.2025983 0,27.5312497 27.8125002,0 0,-27.5312497 z m 13.5312502,6.375 c 2.214833,1.57e-5 3.874988,0.601578 4.96875,1.75 1.093736,1.1484497 1.624986,2.8854277 1.625,5.2187497 l 0,8.71875 -2.5,0 0,-2.3125 c -0.57423,0.929689 -1.29949,1.615886 -2.15625,2.0625 -0.85678,0.4375 -1.916675,0.656249 -3.15625,0.65625 -1.567714,-10e-7 -2.820317,-0.4375 -3.7500002,-1.3125 -0.9205751,-0.884113 -1.3750017,-2.054684 -1.375,-3.53125 -1.7e-6,-1.72265 0.5703102,-3.031243 1.71875,-3.90625 1.1575472,-0.874991 3.0655272,-1.3125 5.1875002,-1.3125 l 3.53125,0 0,-0.25 c -1.2e-5,-1.157541 -0.390637,-2.058582 -1.15625,-2.6875 -0.756521,-0.638008 -1.811207,-0.9374857 -3.1875,-0.9374997 -0.875007,1.4e-5 -1.733079,0.102878 -2.5625,0.3124997 -0.829431,0.209649 -1.640628,0.518242 -2.4062502,0.9375 l 0,-2.3124997 c 0.9205692,-0.355454 1.8216102,-0.639307 2.6875002,-0.8125 0.865879,-0.1822761 1.71093,-0.2812343 2.53125,-0.28125 z m 1.59375,7.9999997 c -2.03256,7e-6 -3.466152,0.222664 -4.25,0.6875 -0.783859,0.464851 -1.156255,1.253912 -1.15625,2.375 -5e-6,0.893233 0.291662,1.627607 0.875,2.15625 0.592442,0.519533 1.394524,0.781252 2.40625,0.78125 1.394522,2e-6 2.505198,-0.515623 3.34375,-1.5 0.847644,-0.993486 1.281238,-2.29687 1.28125,-3.9375 l 0,-0.5625 z',
		unmask: 'm 15.036963,7.9749003 -3.566056,9.1517097 7.145127,0 -3.579071,-9.1517097 m -1.483688,-2.4511305 2.980391,0 7.405422,18.3896382 -2.733109,0 -1.770013,-4.717502 -8.758961,0 -1.7700141,4.717502 -2.7721524,0 L 13.553275,5.5237698 M 1.14441,14.816713 l 0,-13.75803 13.972162,0 13.972162,0 0,13.75803 0,13.75803 -13.972162,0 -13.972162,0 z m 25.149892,0 0,-11.006424 -11.17773,0 -11.1777296,0 0,11.006424 0,11.006424 11.1777296,0 11.17773,0 z',
		selection: 'm 2.4719102,2.6966293 25.0561788,0 0,25.0561807 -25.0561788,0 z',
		selections: 'm 12.640449,12.528089 16.067415,0 0,16.067418 -16.067415,0 z M 1.5193118,1.1320225 l 0,16.0624995 9.2812502,0 0,-6.5625 6.78125,0 0,-9.4999995 -16.0625002,0 z',
		rows: 'M4.082,4.083v2.999h22.835V4.083H4.082zM4.082,20.306h22.835v-2.999H4.082V20.306zM4.082,13.694h22.835v-2.999H4.082V13.694zM4.082,26.917h22.835v-2.999H4.082V26.917z',
		columns: 'm 4.0825,26.9175 2.999,0 0,-22.835 -2.999,0 0,22.835 z m 16.223,0 0,-22.835 -2.999,0 0,22.835 2.999,0 z m -6.612,0 0,-22.835 -2.999,0 0,22.835 2.999,0 z m 13.223,0 0,-22.835 -2.999,0 0,22.835 2.999,0 z',
		collapse: 'M25.083,18.895l-8.428-2.259l2.258,8.428l1.838-1.837l7.053,7.053l2.476-2.476l-7.053-7.053L25.083,18.895zM5.542,11.731l8.428,2.258l-2.258-8.428L9.874,7.398L3.196,0.72L0.72,3.196l6.678,6.678L5.542,11.731zM7.589,20.935l-6.87,6.869l2.476,2.476l6.869-6.869l1.858,1.857l2.258-8.428l-8.428,2.258L7.589,20.935zM23.412,10.064l6.867-6.87l-2.476-2.476l-6.868,6.869l-1.856-1.856l-2.258,8.428l8.428-2.259L23.412,10.064z',
		expand: 'm 22.442659,4.7885628 -6.867,6.8700002 2.476,2.476 6.868,-6.8690002 1.856,1.856 2.258,-8.42800002 -8.428,2.25900002 1.837,1.836 z M 7.2783679,25.007363 l 6.8700011,-6.869 -2.476,-2.476 -6.8690011,6.869 -1.8579996,-1.857 -2.25799993,8.428 8.42799953,-2.258 -1.837,-1.837 z M 8.9349169,2.8930628 0.50691681,0.63506278 2.7649167,9.0630628 l 1.8380002,-1.837 6.6780001,6.6780002 2.476,-2.476 -6.6780001,-6.6780002 1.856,-1.857 z m 11.9177101,24.2527002 8.428,2.259 -2.258,-8.428 -1.838,1.837 -7.053,-7.053 -2.476,2.476 7.053,7.053 -1.856,1.856 z',
		ladderize: 'm 12.215203,20.087313 7.555999,4.361 -7.555999,4.362 0,-2.701 c -2.929,-0.374 -4.905,-2.64 -6.809,-4.952 0.545,-0.703 1.08,-1.418 1.604,-2.127 0.192,-0.26 0.383,-0.514 0.573,-0.77 0.802,1.043 1.584,1.999 2.341,2.74 0.884,0.885 1.673,1.393 2.291,1.588 l 0,-2.501 z m 4.443068,-9.127222 c -1.893,2.371 -3.814999,5.354 -6.008999,7.537 -1.461,1.428 -3.155,2.664 -5.34,2.693 l -3.500001,0 0,-3.5 3.500001,0 c 0.971,0.119 2.845,-1.333 4.712,-3.771 1.895,-2.371 3.814999,-5.3540005 6.010999,-7.5370005 1.326,-1.2969995 2.847,-2.4259995 4.751,-2.6449995 l 0,-2.646 7.556,4.363 -7.556,4.3619997 0,-2.5350002 c -1.04,0.339 -2.581,1.663 -4.125,3.6790005 z m 3.80427,2.712625 7.556,4.361 -7.556,4.362 0,-2.701 c -2.929,-0.374 -4.905,-2.64 -6.809,-4.952 0.545,-0.703 1.08,-1.418 1.604,-2.127 0.192,-0.26 0.383,-0.514 0.573,-0.77 0.802,1.043 1.584,1.999 2.341,2.74 0.884,0.885 1.673,1.393 2.291,1.588 l 0,-2.501 z',
		home: 'M 26.670806,16.493462 V 29.424066 H 18.286212 V 22.39681 h -6.314974 v 7.027256 H 3.5866439 V 16.493462 H 0.58577771 L 15.12876,0.47983084 29.671744,16.493543 h -3.000938 z',
		link: 'M 8.0661255,11.09575 C 8.5908359,10.571119 9.1725964,10.138539 9.7913076,9.7974556 13.239434,7.8966511 17.662037,8.9076608 19.878382,12.268811 l -2.68212,2.682111 c -0.769488,-1.755297 -2.678845,-2.752945 -4.579297,-2.327878 -0.715423,0.160032 -1.395368,0.516774 -1.95096,1.072447 l -5.1418567,5.141714 c -1.5608957,1.560896 -1.5608252,4.100786 1.407e-4,5.661687 1.5608955,1.560899 4.1007223,1.560899 5.661619,0 l 1.585039,-1.584976 c 1.441007,0.571744 2.987643,0.800726 4.513129,0.686277 l -3.498368,3.498358 c -2.999263,2.999265 -7.8619579,2.999265 -10.8612202,0 -2.9992702,-2.99919 -2.9993405,-7.861957 -7.04e-5,-10.861228 L 8.0661255,11.09575 z M 16.231253,2.9305582 12.732887,6.4289264 c 1.525756,-0.1143196 3.072112,0.1146635 4.513192,0.6864089 L 18.831054,5.530297 c 1.560967,-1.560974 4.100793,-1.560974 5.66176,0 1.560966,1.5609656 1.560966,4.1007846 0,5.66176 l -5.141787,5.141646 c -1.565624,1.565624 -4.109486,1.552404 -5.661616,0 -0.361957,-0.361897 -0.674508,-0.812568 -0.868647,-1.255232 l -2.68204,2.682043 c 0.28173,0.427366 0.574801,0.796906 0.950887,1.172991 0.97057,0.970644 2.205549,1.693514 3.62632,2.035293 1.84151,0.443231 3.814603,0.197539 5.509722,-0.736992 0.618713,-0.341151 1.200543,-0.77367 1.725175,-1.298301 l 5.141716,-5.141647 c 2.999263,-2.999263 2.999263,-7.861967 7.1e-5,-10.8612998 -2.999331,-2.99926258 -7.862029,-2.99926258 -10.861362,0 z',
		book: 'M 28.347812,0.36536353 H 4.6478895 C 2.6884607,0.36536353 1.1,1.9538248 1.1,3.9132611 V 26.052111 C 1.1,28.011539 2.6884607,29.6 4.6478895,29.6 H 28.347812 V 5.5117949 c 0,0 -1.950847,0 -4.716783,0 v 9.6172031 l -2.680998,-2.681075 -2.681074,2.681075 V 5.5117949 c -5.906959,0 -12.326514,0 -12.9114881,0 -1.6753856,0 -1.6753856,-2.4500276 0,-2.4500276 0.9675108,0 15.1411971,0 22.9903431,0 V 0.36536353 z',
		book_open: 'M 27.952974,7.6864478 V 21.425765 l -0.8761,0.140796 V 7.6864478 4.9067928 c -4.706511,0.143612 -9.161985,0.900247 -12.17881,2.778318 C 11.881098,5.8070398 7.4257655,5.0504048 2.7192538,4.9067928 v 2.779655 13.8801132 l -0.8761,-0.140796 V 7.6864478 H 0.4 V 23.103626 h 10.94333 c 1.786413,0 1.98247,1.096374 3.554734,1.096374 1.57522,0 1.764942,-1.096374 3.554805,-1.096374 H 29.4 V 7.6864478 H 27.952974 z M 13.701936,21.374376 C 11.35051,20.441394 8.5001062,19.841112 5.0409715,19.581063 V 7.4361848 c 2.8408309,0.238366 6.2397045,0.815698 8.6609645,2.321999 V 21.374376 z m 11.05315,-1.793313 c -3.459204,0.259979 -6.309609,0.860331 -8.660965,1.793313 V 9.7582538 c 2.421261,-1.5063 5.820135,-2.083703 8.660965,-2.321999 V 19.581063 z',
		download: 'm 20.041788,18.510605 v 5.318832 l -9.995423,1.57e-4 V 18.510668 L 7.6359454,16.092571 V 26.243926 H 22.45221 V 16.092571 l -2.410422,2.418034 z M 12.944237,27.510757 11.275915,29.7 h 7.536419 L 17.143976,27.510757 H 12.944237 z M 9.88931,3.6929107 H 20.198993 V 6.0034896 H 9.88931 V 3.6929107 z M 20.198993,10.196814 V 7.5439471 H 9.88931 V 10.196814 H 5.5 l 9.543891,9.577576 9.544186,-9.577576 H 20.198993 z M 9.88931,2.1524536 H 20.198993 V 0.381 H 9.88931 v 1.7714536 z',
		file_blank: 'M 5.115534,26.684466 V 3.315534 h 19.661859 c 0,0 0,13.115109 0,15.34994 0,4.442983 -5.485223,2.663002 -5.485223,2.663002 0,0 1.679395,5.35599 -2.463592,5.35599 -2.256792,0 -3.383146,0 -11.713044,0 z M 27.592927,18.908524 V 0.5 H 2.3 v 29 h 14.571515 c 4.798021,0 10.721412,-6.26942 10.721412,-10.591476 z',
		files: 'm 22.822349,20.958895 h -11.34385 v -2.113446 h 11.34378 v 2.113446 z m 0,-4.115373 h -11.34385 v -2.113445 h 11.34378 v 2.113445 z m 0,-4.039006 H 11.478499 V 10.69107 h 11.34378 v 2.113446 z M 8.6848755,26.782072 V 8.1054804 H 25.545524 c 0,0 0,9.4048346 0,11.6415646 0,3.589547 -4.939052,2.383474 -4.939052,2.383474 0,0 1.170074,4.651553 -2.254343,4.651553 -2.25878,0 -1.330273,0 -9.6672535,0 z M 28.363452,19.638061 V 5.2875525 H 5.8669476 V 29.6 H 18.395032 c 4.802101,0 9.96842,-5.636278 9.96842,-9.961939 z M 3.5656869,26.719866 V 3.0768177 H 25.475076 V 0.6 H 1.1 v 26.119937 h 2.4656869 z',
		file_info: 'M 5.015534,26.784466 V 3.415534 h 19.661859 c 0,0 0,13.115109 0,15.349939 0,4.442983 -5.485223,2.663003 -5.485223,2.663003 0,0 1.679396,5.35599 -2.463592,5.35599 -2.256792,0 -3.383146,0 -11.713044,0 z M 27.492927,19.008524 V 0.6 H 2.2 v 29 h 14.571515 c 4.798021,0 10.721412,-6.26942 10.721412,-10.591476 z M 14.413012,21.86784 c -1.735495,0.609985 -3.166138,-0.08946 -2.879094,-1.756049 0.286973,-1.667077 1.933849,-5.235978 2.168805,-5.91065 0.234745,-0.674884 -0.215458,-0.859935 -0.698041,-0.58542 -0.278315,0.160626 -0.691917,0.482442 -1.047097,0.795177 -0.09833,-0.198143 -0.236927,-0.424794 -0.340891,-0.641801 0.579437,-0.580704 1.548051,-1.359199 2.694818,-1.641245 1.369969,-0.338216 3.659842,0.202366 2.675672,2.821095 -0.702757,1.866487 -1.199769,3.154524 -1.512997,4.113706 -0.312947,0.959534 0.05884,1.160704 0.606818,0.786871 0.428031,-0.292252 0.884218,-0.689806 1.218493,-0.998247 0.154643,0.251356 0.204126,0.331529 0.35708,0.620332 -0.580352,0.594852 -2.098418,1.986852 -3.243566,2.396231 z m 3.595719,-11.545942 c -0.787153,0.670027 -1.953911,0.655456 -2.606551,-0.0328 -0.652571,-0.687835 -0.54368,-1.7886383 0.243262,-2.4588761 0.787153,-0.6699563 1.954051,-0.6554563 2.606551,0.032379 0.6525,0.6881165 0.543679,1.7890601 -0.243262,2.4592981 z',
		file_add: 'm 23.022856,0.5 c -3.213305,0 -5.818313,2.6047976 -5.818313,5.8181027 0,3.2133053 2.605008,5.8181023 5.818313,5.8181023 3.213165,0 5.818033,-2.604797 5.818033,-5.8181023 C 28.840889,3.1047976 26.236021,0.5 23.022856,0.5 z m 3.575641,6.8752432 h -2.51843 V 9.893744 h -1.94506 V 7.3752432 h -2.51843 V 5.430324 h 2.51843 V 2.9119641 h 1.94506 V 5.430324 h 2.51843 V 7.3752432 z M 7.1085454,16.198006 H 20.74343 v 2.108237 H 7.1085454 V 16.198006 z M 20.148204,13.709161 H 7.1085454 V 11.600924 H 17.113748 c 0.8317,0.928116 1.86312,1.652928 3.034456,2.108237 z m 6.403842,-0.289601 v 5.506154 C 26.552046,23.240713 20.638229,29.5 15.847962,29.5 H 1.3 V 0.5468731 h 16.290069 c -0.05791,0.054603 -0.115461,0.1099095 -0.171962,0.1664805 -0.768171,0.7681012 -1.358688,1.6662806 -1.752226,2.6445027 H 4.1109832 V 26.689017 c 8.3164348,0 9.4409678,0 11.6941118,0 4.136291,0 2.45961,-5.347334 2.45961,-5.347334 0,0 5.476358,1.777174 5.476358,-2.658627 0,-0.689183 0,-2.414986 0,-4.470939 0.987849,-0.08834 1.937891,-0.357768 2.810983,-0.792557 z M 7.1085454,7.0096046 h 8.0179076 c 0.06261,0.728396 0.223614,1.4363421 0.476813,2.1082374 H 7.1085454 V 7.0096046 z',
		file_export: 'M 12.532782,11.81826 C 14.234772,4.40665 22.710656,2.89287 22.710656,2.89287 V 0.4 l 5.054727,5.04642 -5.054727,5.04664 V 8.00011 c -7.1e-5,7e-5 -6.554423,-0.0616 -10.177874,3.81815 z M 22.842,13.3459 c 0,2.76499 0,5.43341 0,6.29722 0,4.00108 -4.939714,2.39799 -4.939714,2.39799 0,0 1.512224,4.82336 -2.21871,4.82336 -2.032324,0 -3.04662,0 -10.5480469,0 V 5.81969 H 13.302337 C 14.116731,4.88324 15.080206,4.03408 16.183755,3.28416 H 2.6 V 29.4 h 13.122218 c 4.32093,0 9.655311,-5.64592 9.655311,-9.53804 V 10.81445 C 24.20852,11.98149 24.903393,11.28788 22.842,13.3459 z m -2.703898,5.95738 H 7.8392864 V 17.40153 H 20.138172 v 1.90175 z m -0.002,-4.14671 H 7.8392864 V 13.25495 H 20.136061 v 1.90162 z',
		floppy: 'M 17.065811,4.2836335 H 20.09251 V 9.750485 H 17.065811 V 4.2836335 z M 23.91699,0.6 H 0.9 v 29 H 29.05534 V 5.7383495 L 23.91699,0.6 z M 7.551699,2.7116505 H 21.875728 V 11.299029 H 7.551699 V 2.7116505 z M 24.996255,27.300553 H 4.959085 V 16.061927 h 20.03717 V 27.300553 z M 22.896359,19.358495 H 7.0589806 V 17.950728 H 22.896359 v 1.407767 z m 0,1.618932 H 7.0589806 v 1.407767 H 22.896359 v -1.407767 z m 0,3.026699 H 7.0589806 v 1.407767 H 22.896359 v -1.407767 z',
		prank: 'M 5.4012028,28.354915 C 1.0319612,27.248794 0.3,25.3299 0.3,14.981699 0.3,1.6401892 0.6372533,1.330007 15.143127,1.330007 c 14.296316,0 14.323169,0.023732 14.510514,12.824834 0.207265,14.162095 0.0558,14.320627 -13.789048,14.43588 -5.075676,0.04225 -9.7841987,-0.06384 -10.4633902,-0.235806 z M 25.528673,26.809299 c 2.765271,-1.312209 2.973926,-2.132851 2.975645,-11.703259 0.0023,-12.8916548 0.37323,-12.5466354 -13.488225,-12.5466354 -13.8319735,0 -13.4900852,-0.31282 -13.4891158,12.3422474 9.763e-4,12.76284 -0.1829516,12.590296 13.4209578,12.590296 7.693092,0 9.370182,-0.108204 10.580738,-0.682649 z M 10.386004,22.893168 C 10.143372,21.888553 7.902135,10.237792 7.4764572,7.7682987 l -0.264237,-1.5329264 5.0667668,0 c 4.911166,0 5.120902,0.03636 6.829677,1.1839862 5.952131,3.9974935 3.879912,10.6529955 -3.321643,10.6683595 -0.949488,0.002 -1.095554,0.199071 -1.310604,1.768014 -0.440134,3.211126 -0.906139,3.957191 -2.471742,3.957191 -1.109919,0 -1.442125,-0.188764 -1.618671,-0.919755 z M 17.6749,14.819096 c 1.436786,-0.546264 1.261678,-2.075031 -0.300341,-2.622098 -1.352982,-0.473858 -1.509484,-0.340282 -1.81626,1.550155 -0.265707,1.637348 0.118154,1.831751 2.116601,1.071943 z',
		seq: 'm 0.6,25.014285 0,-2.485714 2.0714286,0 2.0714285,0 0,2.485714 0,2.485715 -2.0714285,0 -2.0714286,0 0,-2.485715 z m 4.9714286,0 0,-2.485714 2.0714286,0 2.0714278,0 0,2.485714 0,2.485715 -2.0714278,0 -2.0714286,0 0,-2.485715 z m 4.9714284,0 0,-2.485714 2.071429,0 2.071428,0 0,2.485714 0,2.485715 -2.071428,0 -2.071429,0 0,-2.485715 z m 14.914285,0 0,-2.485714 2.07143,0 2.071428,0 0,2.485714 0,2.485715 -2.071428,0 -2.07143,0 0,-2.485715 z M 0.6,18.8 l 0,-2.9 2.0714286,0 2.0714285,0 0,2.9 0,2.899999 -2.0714285,0 -2.0714286,0 L 0.6,18.8 z m 4.9714286,0 0,-2.9 2.0714286,0 2.0714278,0 0,2.9 0,2.899999 -2.0714278,0 -2.0714286,0 0,-2.899999 z m 4.9714284,0 0,-2.9 2.071429,0 2.071428,0 0,2.9 0,2.899999 -2.071428,0 -2.071429,0 0,-2.899999 z m 4.971429,0 0,-2.9 2.071428,0 2.071429,0 0,2.9 0,2.899999 -2.071429,0 -2.071428,0 0,-2.899999 z m 9.942856,0 0,-2.9 2.07143,0 2.071428,0 0,2.9 0,2.899999 -2.071428,0 -2.07143,0 0,-2.899999 z M 0.6,12.171428 l 0,-2.8999998 2.0714286,0 2.0714285,0 0,2.8999998 0,2.9 -2.0714285,0 -2.0714286,0 0,-2.9 z m 4.9714286,0 0,-2.8999998 2.0714286,0 2.0714278,0 0,2.8999998 0,2.9 -2.0714278,0 -2.0714286,0 0,-2.9 z m 4.9714284,0 0,-2.8999998 2.071429,0 2.071428,0 0,2.8999998 0,2.9 -2.071428,0 -2.071429,0 0,-2.9 z m 9.942858,0 0,-2.8999998 2.071428,0 2.071428,0 0,2.8999998 0,2.9 -2.071428,0 -2.071428,0 0,-2.9 z m 4.971427,0 0,-2.8999998 2.07143,0 2.071428,0 0,2.8999998 0,2.9 -2.071428,0 -2.07143,0 0,-2.9 z M 0.6,5.5428568 l 0,-2.9 2.0714286,0 2.0714285,0 0,2.9 0,2.9000001 -2.0714285,0 -2.0714286,0 0,-2.9000001 z m 4.9714286,0 0,-2.9 2.0714286,0 2.0714278,0 0,2.9 0,2.9000001 -2.0714278,0 -2.0714286,0 0,-2.9000001 z m 4.9714284,0 0,-2.9 2.071429,0 2.071428,0 0,2.9 0,2.9000001 -2.071428,0 -2.071429,0 0,-2.9000001 z m 9.942858,0 0,-2.9 2.071428,0 2.071428,0 0,2.9 0,2.9000001 -2.071428,0 -2.071428,0 0,-2.9000001 z m 4.971427,0 0,-2.9 2.07143,0 2.071428,0 0,2.9 0,2.9000001 -2.071428,0 -2.07143,0 0,-2.9000001 z',
		close: 'M 15,0.5 C 6.9918471,0.5 0.5,6.9918471 0.5,15 0.5,23.008153 6.9918471,29.5 15,29.5 23.008153,29.5 29.5,23.008153 29.5,15 29.5,6.9918471 23.008153,0.5 15,0.5 z m 5.499019,23.12574 -5.42849,-5.428138 -5.4285606,5.428842 -2.9158373,-2.917527 5.4273639,-5.428138 -5.4279974,-5.427646 2.9174563,-2.9157665 5.4271531,5.4263785 5.426238,-5.4270824 2.91823,2.9163304 -5.427223,5.427505 5.427857,5.427082 -2.91619,2.91816 z',
		x: 'M 21.259103,24.456135 14.893786,18.091104 8.5282816,24.456892 5.109218,21.03575 11.473304,14.670905 5.1085562,8.3065359 8.5296052,4.8874717 14.893315,11.25033 l 6.362762,-6.3636146 3.421806,3.4196309 -6.363899,6.3641817 6.364655,6.363708 -3.419536,3.421899 z'
	};
	paths['default'] = paths.selections;
	
	if(!options) options = {};
	var transform = options.transform ? 'transform="'+options.transform+'"' : '';
	var fill = options.fill ? 'fill:'+options.fill : '';
	var stroke = options.stroke ? 'stroke:'+options.stroke : '';
	if(fill&&stroke) fill+=',';
	var shadow = options.shadow? 'filter="url(#dropshadow)"' : '';
	var vbox = options.shadow? '-10 -10 50 50' : '0 0 30 30';
	if(typeof(options.shadow)!='object') options.shadow = {};
	var sh = {x:options.shadow.x||0, y:options.shadow.y||0, blur:options.shadow.blur||3};
	var shadowdef = '<filter id="dropshadow" width="140%" height="140%" x="-20%" y="-20%"><feGaussianBlur in="SourceAlpha" stdDeviation="'+sh.blur+'" /><feColorMatrix type="matrix" value="1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0.6,0"/><feOffset dx="'+sh.x+'" dy="'+sh.y+'" /><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
	var iconstr = '<svg class="icon" preserveAspectRatio="none" viewBox="'+vbox+'" '+transform+'>'+(shadow?shadowdef:'')+'<path d="'+(paths[type]||'')+'" '+(fill||stroke?' style="'+fill+stroke+'"':'')+' '+shadow+'></path></svg>';
	var title = options.title? 'title="'+options.title+'"' : '';
	return options.span? '<span class="svgicon" '+title+'>'+iconstr+'</span>' : iconstr;
}