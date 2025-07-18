{
  lib,
  stdenv,
  fetchFromGitHub,
  zig,
}:

stdenv.mkDerivation rec {
  pname = "ziggy";
  version = "3de840f7c7ec1d4c384c5c69fe9715eb8bb72763";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = version;
    hash = "sha256-ymk7U9IGcPFCFzvF2uRdIBJ7oNc/gWzV/djVVPgBaUE=";
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
