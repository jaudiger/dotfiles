{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "ziggy";
  version = "fe3bf9389e7ff213cf3548caaf9c6f3d4bb38647";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = version;
    hash = "sha256-w2WO2N3+XJWhWnt9swOux2ynKxmePbB4VojXM8K5GAo=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "A data serialization language for expressing clear API messages, config files, etc.";
    homepage = "https://ziggy-lang.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
