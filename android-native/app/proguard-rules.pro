# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.snape.flix.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.snape.flix.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.snape.flix.data.**$$serializer { *; }
