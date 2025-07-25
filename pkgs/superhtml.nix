{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "superhtml";
  version = "daf47cfb1b393955b382ef91460e45837515b88e";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = version;
    hash = "sha256-YKRFV/OhufaDSwvPzlDDLACLLmOizeLb00rznnLLPHo=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
