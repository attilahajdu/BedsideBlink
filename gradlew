#!/bin/sh

#
# Copyright © 2015 the original authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0
#

# Resolve links: $0 may be a link
app_path=$0
while [ -h "$app_path" ]; do
  ls=$( ls -ld "$app_path" )
  link=${ls#*' -> '}
  case $link in
    /*) app_path=$link ;;
    *) app_path=$( dirname "$app_path" )/$link ;;
  esac
done
APP_HOME=$( cd -P "$( dirname "$app_path" )" > /dev/null && pwd )

# Add default JVM options here.
exec java -Dfile.encoding=UTF-8 -Xmx64m -Xms64m $JAVA_OPTS $GRADLE_OPTS -jar "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" "$@"
