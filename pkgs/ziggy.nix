{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "ziggy";
  version = "4353b20ef2ac750e35c6d68e4eb2a07c2d7cf901";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = version;
    hash = "sha256-7XZNKUrOkpPMge6nDSiEBlUAf7dZLDcVcJ7fHT8fPh4=";
  };

  nativeBuildInputs = [
    zig.hook
  ];

  meta = with lib; {
    description = "A data serialization language for expressing clear API messages, config files, etc";
    homepage = "https://ziggy-lang.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
