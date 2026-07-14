{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation rec {
  pname = "ziggy";
  version = "0.2.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "ziggy";
    rev = "v${version}";
    hash = "sha256-luLYcGQ/2yi5SZbv1l7Be9LcizqiZdJY1i6TuxqFLdg=";
  };

  nativeBuildInputs = [
    zig_master
  ];

  buildPhase = "zig build --global-cache-dir .zig-cache -Doptimize=ReleaseFast";
  installPhase = "install -Dm755 zig-out/bin/ziggy -t $out/bin";

  meta = with lib; {
    description = "A data serialization language for expressing clear API messages, config files, etc";
    homepage = "https://ziggy-lang.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
}
